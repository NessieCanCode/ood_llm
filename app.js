const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { createProxyMiddleware } = require('http-proxy-middleware');
const session = require('express-session');

const log = require('./logger');
const config = require('./config');

const app = express();
const router = express.Router();
if (config.baseUri && !config.baseUri.endsWith('/')) {
  app.get(config.baseUri, (req, res) => res.redirect(config.baseUri + '/'));
}
app.use(config.baseUri || '/', router);

const sessionJobs = {};

async function launchSlurmJob() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'scripts', 'run_llama.sh');
    const env = {
      ...process.env,
      SLURM_PARTITION: config.slurmPartition,
      GPU_TYPE: config.gpuType,
      LLAMA_ARGS: config.llamaArgs,
    };
    const sbatch = spawn('sbatch', [scriptPath], { env });
    let output = '';
    sbatch.stdout.on('data', d => (output += d.toString()));
    sbatch.stderr.on('data', d => console.error('sbatch:', d.toString()));
    sbatch.on('close', code => {
      if (code === 0) {
        const match = output.match(/Submitted batch job (\d+)/);
        if (match) return resolve(match[1]);
        return reject(new Error('Unable to parse sbatch output'));
      }
      reject(new Error('sbatch failed'));
    });
  });
}

function startTimer(sid) {
  const info = sessionJobs[sid];
  if (!info) return;
  if (info.timer) clearTimeout(info.timer);
  info.timer = setTimeout(() => cancelJob(sid), config.sessionTimeout * 1000);
}

function cancelJob(sid) {
  const info = sessionJobs[sid];
  if (info && info.jobId) {
    spawn('scancel', [info.jobId]);
    log(`Cancelled job ${info.jobId} for session ${sid}`);
  }
  if (info && info.timer) clearTimeout(info.timer);
  if (info && info.interval) clearInterval(info.interval);
  delete sessionJobs[sid];
}

async function testConnection(url) {
  return new Promise(resolve => {
    const req = http.get(url, () => {
      req.destroy();
      resolve(true);
    });
    req.on('error', () => resolve(false));
  });
}

function pollForStatus(jobId, sid) {
  const info = sessionJobs[sid];
  if (!info) return;
  const logFile = path.join(__dirname, `llama_${jobId}.log`);
  let interval;
  const check = () => {
    if (fs.existsSync(logFile)) {
      const data = fs.readFileSync(logFile, 'utf8');
      if (!info.port) {
        const m = data.match(/PORT=(\d+)/);
        if (m) info.port = parseInt(m[1], 10);
      }
      if (!info.host) {
        const m = data.match(/HOST=([A-Za-z0-9_.-]+)/);
        if (m) info.host = m[1];
      }
    }

    if (!info.host) {
      const squeue = spawn('squeue', ['-j', jobId, '-h', '-o', '%B']);
      let out = '';
      squeue.stdout.on('data', d => (out += d.toString()));
      squeue.on('close', code => {
        if (code === 0 && out.trim()) info.host = out.trim();
      });
    }

    if (info.host && info.port && !info.url) {
      info.url = `http://${info.host}:${info.port}`;
      log(`Job ${jobId} running on ${info.host}:${info.port}`);
    }

    if (info.url && !info.connected) {
      testConnection(info.url).then(ok => {
        if (ok) {
          info.connected = true;
          clearInterval(interval);
          delete info.interval;
        }
      });
    }
  };
  interval = setInterval(check, 5000);
  info.interval = interval;
  check();
}

router.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: config.sessionTimeout * 1000 },
}));
router.use(express.json());

router.post('/launch', async (req, res) => {
  const sid = req.sessionID;
  const info = sessionJobs[sid];
  if (info && (info.jobId || info.url)) {
    startTimer(sid);
    return res.json({ jobId: info.jobId || null });
  }
  if (config.llamaServerUrl) {
    sessionJobs[sid] = { url: config.llamaServerUrl };
    startTimer(sid);
    return res.json({ jobId: null });
  }
  try {
    const jobId = await launchSlurmJob();
    sessionJobs[sid] = { jobId };
    startTimer(sid);
    pollForStatus(jobId, sid);
    log(`Launched job ${jobId} for session ${sid}`);
    res.json({ jobId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', (req, res) => {
  const info = sessionJobs[req.sessionID] || {};
  res.json({
    jobId: info.jobId || null,
    running: !!info.url,
    connected: !!info.connected,
  });
});

router.post('/keepalive', (req, res) => {
  startTimer(req.sessionID);
  res.end();
});

router.post('/end', (req, res) => {
  cancelJob(req.sessionID);
  res.end();
});

router.use('/api', (req, res, next) => {
  const info = sessionJobs[req.sessionID];
  if (!info || !info.url) {
    return res.status(503).send('LLaMA server not ready');
  }
  startTimer(req.sessionID);
  return createProxyMiddleware({
    target: info.url,
    changeOrigin: true,
    pathRewrite: path => path.replace(/^\/api/, ''),
  })(req, res, next);
});

router.use(express.static(path.join(__dirname, 'public')));

router.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  const msg = `Express app listening on ${config.baseUri} (port ${port})`;
  console.log(`> ${msg}`);
  log(msg);
});
