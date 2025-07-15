require('dotenv').config({ path: '.env.local' });

const baseUri = (process.env.PASSENGER_BASE_URI || '/').replace(/\/?$/, '/');
process.env.NEXT_PUBLIC_BASE_URI = process.env.NEXT_PUBLIC_BASE_URI || baseUri;

const config = {
  baseUri,
  llamaServerUrl: process.env.LLAMA_SERVER_URL || null,
  llamaServerPort: process.env.LLAMA_SERVER_PORT || 8000,
  slurmPartition: process.env.SLURM_PARTITION || 'gpu',
  gpuType: process.env.GPU_TYPE || 'gpu:1',
  llamaArgs: process.env.LLAMA_ARGS || '',
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 600,
};

module.exports = config;
