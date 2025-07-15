const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '.env.local'),
  override: true,
});

const config = {
  baseUri: process.env.PASSENGER_BASE_URI || '/',
  llamaServerUrl: process.env.LLAMA_SERVER_URL || null,
  llamaServerPort: process.env.LLAMA_SERVER_PORT || 8000,
  slurmPartition: process.env.SLURM_PARTITION || 'gpu',
  gpuType: process.env.GPU_TYPE || 'gpu:1',
  llamaArgs: process.env.LLAMA_ARGS || '',
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 600,
};

module.exports = config;
