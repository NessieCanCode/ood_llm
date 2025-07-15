# RufusAI Passenger App

This repository contains a small [Next.js](https://nextjs.org/) passenger app used to provide a web front end for a running [LLaMA.cpp](https://github.com/ggerganov/llama.cpp) server. It is designed to be deployed on [Open OnDemand](https://openondemand.org/) so users can launch interactive LLM sessions through a browser.

## Requirements
* Node.js 18 or newer
* Open OnDemand 2.x with Passenger apps enabled
* Access to a Slurm cluster capable of running the `llama.cpp` server
* A compute node with at least one GPU (16&nbsp;GB VRAM recommended) or a high core-count CPU node

## Running locally
1. `npm install`
2. Copy `.env.example` to `.env.local` and edit values if needed
3. `npm run dev`
4. Open <http://localhost:3000> to view the demo page

## Deploying on Open OnDemand
1. Copy this repository to your OOD development apps directory, for example:
   ```bash
   cp -r ood_llm ~/ondemand/dev/ood_llm
   ```
2. From a shell on the OOD host install dependencies **and build the production bundle**:
   ```bash
   cd ~/ondemand/dev/ood_llm
   npm install --production
   npm run build
   ```
3. Visit **My Sandbox Apps** on the OOD dashboard and choose **ood_llm** then **Develop**. Passenger will start `node app.js` for you and mount it under `/pun/dev/ood_llm`.

## Launching the LLaMA.cpp server with Slurm
When a user visits the web interface the application automatically submits a Slurm job
using the `scripts/run_llama.sh` script.  The script starts
`llama.cpp` in server mode on the allocated node.  Edit the script or set the
environment variables below so it can locate your built `llama.cpp` binary and
model file.

### Runtime configuration
Several environment variables control how the Slurm job is launched. All have sane defaults and are optional:

| Variable | Default | Description |
| --- | --- | --- |
| `SLURM_PARTITION` | `gpu` | Slurm partition used when submitting the job |
| `GPU_TYPE` | `gpu:1` | `--gres` value specifying the GPU resource requirement |
| `PASSENGER_BASE_URI` | `/` | Base URI where the app is mounted |
| `LLAMA_SERVER_URL` | *(empty)* | Connect to an existing `llama.cpp` server instead of launching one |
| `LLAMA_CPP_BIN` | `/path/to/llama.cpp/server` | Path to the `llama.cpp` server executable |
| `MODEL` | `/path/to/models/llama-7b.gguf` | GGUF model file to load |
| `LLAMA_ARGS` | *(empty)* | Extra command line arguments passed to `llama.cpp` |
| `LLAMA_SERVER_PORT` | `8000` | Port the server listens on |
| `SESSION_TIMEOUT` | `600` | Seconds of inactivity before the job is cancelled |

Set any of these variables in your shell before launching the app:
```bash
export SLURM_PARTITION=debug
export GPU_TYPE=gpu:a100:1
export LLAMA_CPP_BIN=/software/llama.cpp/server
export MODEL=/software/models/llama-7b.gguf
export LLAMA_ARGS="--n-gpu-layers 40"
export LLAMA_SERVER_PORT=8001
export LLAMA_SERVER_URL=http://login.example.com:8001
```

### Build-time environment injection
Values in `.env.example` are used as a template for `.env.local`. During
`npm run build` the script `scripts/generateEnv.js` writes a fresh `.env.local`
using any matching variables from your shell environment. **`PASSENGER_BASE_URI`
must be set before running the build.** The build stores this value in
`.next/build-meta.json` and the server will refuse to start if the runtime value
differs. This allows sensitive values to be injected without committing them to
the repository and prevents accidental reuse of stale builds.

## Basic usage
1. Launch the **ood_llm** app from the OOD dashboard.
2. Visit the app URL. Opening the page submits the Slurm job automatically and connects once `llama.cpp` is ready.
3. Enter a prompt in the chat box to interact with the model.

This setup allows users to interact with large language models through the comfort of a web browser while leveraging their institution's HPC resources.

## Development workflow
Run the linter and unit tests before submitting changes:
```bash
npm run lint
npm test
```
