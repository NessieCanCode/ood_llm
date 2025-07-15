# RufusAI Passenger App

This repository contains a small [Next.js](https://nextjs.org/) passenger app used to provide a web front end for a running [LLaMA.cpp](https://github.com/ggerganov/llama.cpp) server. It is designed to be deployed on [Open OnDemand](https://openondemand.org/) so users can launch interactive LLM sessions through a browser.

## Requirements
* Node.js 18 or newer
* Open OnDemand 2.x with Passenger apps enabled
* Access to a Slurm cluster capable of running the `llama.cpp` server
* A compute node with at least one GPU (16&nbsp;GB VRAM recommended) or a high core-count CPU node

## Running locally
1. `cd nextjs`
2. `npm install`
3. `npm run dev`
4. Open <http://localhost:3000> to view the demo page

## Deploying on Open OnDemand
1. Copy the `nextjs` directory to your OOD development apps directory, for example:
   ```bash
   cp -r nextjs ~/ondemand/dev/ood_llm
   ```
2. From a shell on the OOD host install dependencies:
   ```bash
   cd ~/ondemand/dev/ood_llm
   npm install --production
   ```
3. Visit **My Sandbox Apps** on the OOD dashboard and choose **ood_llm** then **Develop**. Passenger will start `node app.js` for you and mount it under `/pun/dev/ood_llm`.

## Launching the LLaMA.cpp server with Slurm
The front end expects an instance of `llama.cpp` started in server mode. An example interactive job might be:
```bash
salloc -N1 -c 32 --gres=gpu:1 --mem=64G -t 02:00:00
module load cuda
/path/to/llama.cpp/server -m /path/to/models/llama-7b --port 8000
```
Adjust the resources to match your model size. The job should remain running so the passenger app can connect. Note the node name (e.g. `node123`) where the server is started.

## Connecting the passenger app
Before launching the OOD app, set the following environment variable so the front end knows where to reach the backend:
```bash
export LLAMA_SERVER_URL=http://node123:8000
```
Passenger passes environment variables through to `app.js`, which can read `process.env.LLAMA_SERVER_URL` to forward requests.

### Runtime configuration
Several environment variables control how the Slurm job is launched. All have sane defaults and are optional:

| Variable | Default | Description |
| --- | --- | --- |
| `SLURM_PARTITION` | `gpu` | Slurm partition used when submitting the job |
| `GPU_TYPE` | `gpu:1` | `--gres` value specifying the GPU resource requirement |
| `LLAMA_ARGS` | *(empty)* | Extra command line arguments passed to `llama.cpp` |
| `LLAMA_SERVER_PORT` | `8000` | Port the server listens on |
| `SESSION_TIMEOUT` | `600` | Seconds of inactivity before the job is cancelled |

These can be set in your shell before launching the app:
```bash
export SLURM_PARTITION=debug
export GPU_TYPE=gpu:a100:1
export LLAMA_ARGS="--n-gpu-layers 40"
export LLAMA_SERVER_PORT=8001
```

## Basic usage
1. Start the Slurm job running `llama.cpp` as shown above.
2. Set `LLAMA_SERVER_URL` in your environment.
3. Launch the **ood_llm** app from the OOD dashboard.
4. Navigate to the app URL; enter a prompt and submit it to get a response from the LLaMA server.

This setup allows users to interact with large language models through the comfort of a web browser while leveraging their institution's HPC resources.

## Development workflow
Run the linter and unit tests before submitting changes:
```bash
cd nextjs
npm run lint
npm test
```
