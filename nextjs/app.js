const express = require('express');
const next    = require('next');
const { spawn } = require('child_process');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const baseUri = process.env.PASSENGER_BASE_URI || '/';

async function launchSlurmJob() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'scripts', 'run_llama.sh');
    const sbatch = spawn('sbatch', [scriptPath]);
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

function pollForNode(jobId) {
  let interval;
  const check = () => {
    const squeue = spawn('squeue', ['-j', jobId, '-h', '-o', '%B']);
    let out = '';
    squeue.stdout.on('data', d => out += d.toString());
    squeue.on('close', code => {
      if (code === 0) {
        const node = out.trim();
        if (node) {
          llamaUrl = `http://${node}:${llamaPort}`;
          console.log(`LLaMA server expected at ${llamaUrl}`);
          clearInterval(interval);
        }
      }
    });
  };
  interval = setInterval(check, 5000);
  check();
}

let slurmJobId = null;
let llamaUrl = process.env.LLAMA_SERVER_URL || null;
const llamaPort = process.env.LLAMA_SERVER_PORT || 8000;

app.prepare().then(() => {
  const server = express();

  server.use(express.json());

  server.post(`${baseUri}launch`, async (req, res) => {
    if (slurmJobId) {
      return res.json({ jobId: slurmJobId });
    }
    try {
      slurmJobId = await launchSlurmJob();
      pollForNode(slurmJobId);
      res.json({ jobId: slurmJobId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  server.use(`${baseUri}api`, (req, res, next) => {
    if (!llamaUrl) {
      return res.status(503).send('LLaMA server not ready');
    }
    return createProxyMiddleware({
      target: llamaUrl,
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
