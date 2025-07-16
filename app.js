const express = require('express');
const next    = require('next');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');
const session = require('express-session');

const log = require('./logger');

const config = require('./config');

// Phusion Passenger sets PASSENGER_APP_ENV instead of NODE_ENV
// Map it so libraries relying on NODE_ENV behave correctly
if (!process.env.NODE_ENV && process.env.PASSENGER_APP_ENV) {
  process.env.NODE_ENV = process.env.PASSENGER_APP_ENV;
}

// Ensure runtime baseUri matches value used during build
try {
  const metaPath = path.join(__dirname, '.next', 'build-meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (meta.baseUri && meta.baseUri !== config.baseUri) {
    console.error(
      `PASSENGER_BASE_URI mismatch: built with ${meta.baseUri} but running with ${config.baseUri}. Rebuild with the correct value.`
    );
    process.exit(1);
  }
} catch (err) {
  // Ignore if meta file missing
}

const dev = process.env.NODE_ENV !== 'production';
if (!dev) {
  const buildDir = path.join(__dirname, '.next');
  if (!fs.existsSync(buildDir)) {
    console.log('No production build found. Running "npm run build"...');
    try {
      execSync('npm run build', { stdio: 'inherit' });
    } catch (err) {
      console.error('Failed to build application');
      process.exit(1);
    }
  }
}
const app = next({ dev });
const handle = app.getRequestHandler();

const baseUri = config.baseUri;
const prefix = baseUri.replace(/\/$/, '');
const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sessionJobs = {};

async function launchSlurmJob() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'scripts', 'run_llama.sh');
    const env = {
      ...process.env,
      SLURM_PARTITION: config.slurmPartition,
      GPU_TYPE: config.gpuType,
      LLAMA_ARGS: config.llamaArgs,
      PORT: config.llamaServerPort,
    };
    const sbatch = spawn('sbatch', [scriptPath], { env });
    let output = '';
    sbatch.stdout.on('data', d => output += d.toString());
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

function pollForNode(jobId, sid, cb) {
  const info = sessionJobs[sid];
  if (!info) return;
  let interval;
  const check = () => {
    const squeue = spawn('squeue', ['-j', jobId, '-h', '-o', '%B']);
    let out = '';
    squeue.stdout.on('data', d => out += d.toString());
    squeue.on('error', err => console.error('squeue error:', err));
    squeue.on('close', code => {
      if (code === 0) {
        const node = out.trim();
        if (node) {
          const url = `http://${node}:${llamaPort}`;
          console.log(`LLaMA server expected at ${url}`);
          log(`Job ${jobId} running on ${node}`);
          clearInterval(interval);
          delete info.interval;
          if (cb) cb(url);
        }
      }
    });
  };
  interval = setInterval(check, 5000);
  info.interval = interval;
  check();
}

const llamaPort = config.llamaServerPort;

app.prepare().then(() => {
  const server = express();

  server.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: config.sessionTimeout * 1000 },
  }));
  server.use(express.json());

  server.post(`${prefix}/launch`, async (req, res) => {
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
      pollForNode(jobId, sid, url => {
        sessionJobs[sid].url = url;
      });
      log(`Launched job ${jobId} for session ${sid}`);
      res.json({ jobId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  server.post(`${prefix}/keepalive`, (req, res) => {
    startTimer(req.sessionID);
    res.end();
  });

  server.post(`${prefix}/end`, (req, res) => {
    cancelJob(req.sessionID);
    res.end();
  });

  server.use(`${prefix}/api`, (req, res, next) => {
    const info = sessionJobs[req.sessionID];
    if (!info || !info.url) {
      return res.status(503).send('LLaMA server not ready');
    }
    startTimer(req.sessionID);
    return createProxyMiddleware({
      target: info.url,
      changeOrigin: true,
      pathRewrite: path => path.replace(new RegExp(`^${escapeRegex(prefix)}/api`), ''),
    })(req, res, next);
  });

  // Mount under the base URI
  server.use(baseUri, (req, res) => {
    // Strip off the base path before handing to Next
    const stripped = baseUri === '/'
      ? req.url
      : req.url.replace(new RegExp(`^${escapeRegex(baseUri)}`), '') || '/';
    req.url = stripped;
    return handle(req, res);
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    const msg = `Next.js app listening on ${baseUri} (port ${port})`;
    console.log(`> ${msg}`);
    log(msg);
  });
});

