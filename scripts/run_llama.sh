#!/usr/bin/env bash
#SBATCH --job-name=llama_server
#SBATCH --nodes=1
#SBATCH --gres=${GPU_TYPE:-gpu:1}
#SBATCH --partition=${SLURM_PARTITION:-gpu}
#SBATCH --time=02:00:00
#SBATCH --output=llama_%j.log

# Optional resources
#SBATCH --cpus-per-task=16
#SBATCH --mem=64G

PORT=${PORT:-8000}
LLAMA_CPP_BIN=${LLAMA_CPP_BIN:-/path/to/llama.cpp/server}
MODEL=${MODEL:-/path/to/models/llama-7b.gguf}
LLAMA_ARGS=${LLAMA_ARGS:-}

module load cuda >/dev/null 2>&1 || true

srun "$LLAMA_CPP_BIN" -m "$MODEL" --port "$PORT" --host 0.0.0.0 $LLAMA_ARGS


