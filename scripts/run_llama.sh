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

LLAMA_CPP_BIN=${LLAMA_CPP_BIN:-/path/to/llama.cpp/server}
MODEL=${MODEL:-/path/to/models/llama-7b.gguf}
LLAMA_ARGS=${LLAMA_ARGS:-}

# pick a free port between 8080 and 8090
for p in {8080..8090}; do
  if ! ss -ltn | awk '{print $4}' | grep -q ":$p$"; then
    PORT=$p
    break
  fi
done

HOST=$(hostname)

module load cuda >/dev/null 2>&1 || true

echo "PORT=$PORT"
echo "HOST=$HOST"

srun "$LLAMA_CPP_BIN" -m "$MODEL" --port "$PORT" --host "$HOST" --no-webui --alias RufusAI $LLAMA_ARGS


