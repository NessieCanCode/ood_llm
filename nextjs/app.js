const express = require('express');
const next    = require('next');
const { spawn } = require('child_process');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const session = require('express-session');

const log = require('./logger');

const config = require('./config');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const baseUri = config.baseUri;
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
  delete sessionJobs[sid];
}

function pollForNode(jobId, cb) {
  let interval;
  const check = () => {
    const squeue = spawn('squeue', ['-j', jobId, '-h', '-o', '%B']);
    let out = '';
    squeue.stdout.on('data', d => out += d.toString());
    squeue.on('close', code => {
      if (code === 0) {
        const node = out.trim();
        if (node) {
          const url = `http://${node}:${llamaPort}`;
          console.log(`LLaMA server expected at ${url}`);
          log(`Job ${jobId} running on ${node}`);
          clearInterval(interval);
          if (cb) cb(url);
        }
      }
    });
  };
  interval = setInterval(check, 5000);
  check();
}

const llamaPort = config.llamaServerPort;

app.prepare().then(() => {
  const server = express();

  server.use(session({
    secret: 'ood_llm_secret',
    resave: false,
    saveUninitialized: true,
  }));
  server.use(express.json());

  server.post(`${baseUri}launch`, async (req, res) => {
    const sid = req.sessionID;
    const info = sessionJobs[sid];
    if (info && info.jobId) {
      startTimer(sid);
      return res.json({ jobId: info.jobId });
    }
    try {
      const jobId = await launchSlurmJob();
      sessionJobs[sid] = { jobId };
      startTimer(sid);
      pollForNode(jobId, url => {
        sessionJobs[sid].url = url;
      });
      log(`Launched job ${jobId} for session ${sid}`);
      res.json({ jobId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  server.post(`${baseUri}keepalive`, (req, res) => {
    startTimer(req.sessionID);
    res.end();
  });

  server.post(`${baseUri}end`, (req, res) => {
    cancelJob(req.sessionID);
    res.end();
  });

  server.use(`${baseUri}api`, (req, res, next) => {
    const info = sessionJobs[req.sessionID];
    if (!info || !info.url) {
      return res.status(503).send('LLaMA server not ready');
    }
    startTimer(req.sessionID);
    return createProxyMiddleware({
      target: info.url,
      changeOrigin: true,
      pathRewrite: path => path.replace(new RegExp(`^${baseUri}api`), ''),
    })(req, res, next);
  });

  // Mount under the base URI
  server.use(baseUri, (req, res) => {
    // Strip off the base path before handing to Next
    req.url = req.url.replace(new RegExp(`^${baseUri}`), '') || '/';
    return handle(req, res);
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> Next.js app listening on ${baseUri} (port ${port})`);
  });
});
