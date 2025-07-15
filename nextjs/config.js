const config = {
  baseUri: process.env.PASSENGER_BASE_URI || '/',
  llamaServerUrl: process.env.LLAMA_SERVER_URL || null,
  llamaServerPort: process.env.LLAMA_SERVER_PORT || 8000,
  slurmPartition: process.env.SLURM_PARTITION || 'gpu',
  gpuType: process.env.GPU_TYPE || 'gpu:1',
  llamaArgs: process.env.LLAMA_ARGS || '',
};

module.exports = config;
