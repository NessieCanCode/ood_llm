require('dotenv').config({ path: '.env.local' });

const DEFAULT_SESSION_TIMEOUT = 600;

let baseUri = process.env.PASSENGER_BASE_URI || '/';
if (!baseUri.startsWith('/')) baseUri = '/' + baseUri;

const config = {
  baseUri,
  llamaServerUrl: process.env.LLAMA_SERVER_URL || null,
  llamaServerPort: parseInt(process.env.LLAMA_SERVER_PORT, 10) || 8000,
  slurmPartition: process.env.SLURM_PARTITION || 'gpu',
  gpuType: process.env.GPU_TYPE || 'gpu:1',
  llamaArgs: process.env.LLAMA_ARGS || '',
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || DEFAULT_SESSION_TIMEOUT,
  sessionSecret: process.env.SESSION_SECRET || 'ood_llm_secret',
};

module.exports = config;

