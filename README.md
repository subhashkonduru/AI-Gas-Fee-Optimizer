# Gas Whisperer — AI-Powered Gas Fee Optimizer (demo)

This repository is a demo scaffold that combines:

- A Rust example (`rust_contract/`) that demonstrates the same gas-optimization heuristic you'd compile to WASM for Stylus.
- A Python FastAPI backend (`backend/`) that serves optimization, explanation and prediction endpoints.
- A small React + Tailwind frontend (`frontend/`) served statically that calls the backend.
- A Hardhat deploy scaffold (`deploy/`) with a sample Solidity contract and deploy scripts.

What this repo shows
- How an on-chain-aware service can suggest gas prices and timing using a simple heuristic and optional AI explanations.
- How the Rust logic maps to the Python backend so results stay consistent for a Stylus/WASM flow.

Quick start (safe, simulated data)

1) Start the backend using the mocked gas data (no RPC keys required):

```powershell
cd "I:\Subhash Imp Projects\AI-Powered Gas Fee Optimizer on Arbitrum Stylus\backend"
.\.venv\Scripts\Activate.ps1  # activate your virtualenv (create it if needed)
pip install -r requirements.txt
$env:USE_REAL_DATA = '0'  # ensure backend uses mock data
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

2) Serve the frontend and open the UI:

```powershell
cd "I:\Subhash Imp Projects\AI-Powered Gas Fee Optimizer on Arbitrum Stylus\frontend"
python -m http.server 3000
# open http://127.0.0.1:3000 in your browser
```

3) Verify the backend returns mocked samples:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/fetch-recent" -Method GET | ConvertTo-Json -Depth 5
# expect: { "source": "mock", "recent": [ ... ] }
```

Using real RPC or AI (optional)

If you'd like live Arbitrum data or OpenAI predictions, create a local `.env` file in `backend/` or set these env vars before starting the backend:

- `RPC_URL` — an Arbitrum RPC endpoint (e.g. Alchemy/Infura/other)
- `USE_REAL_DATA=1` — enables RPC fetching
- `OPENAI_API_KEY` — optional, used by `/ai-predict`

Example (PowerShell):

```powershell
cd backend
@"
RPC_URL=https://arb1.arbitrum.io/rpc
USE_REAL_DATA=1
OPENAI_API_KEY=sk-...   # optional
"@ | Out-File -FilePath .env -Encoding utf8

.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Endpoints of interest

- `POST /optimize` — returns suggested gas (gwei), risk, human-friendly reason, and `wait_seconds` for timing.
- `GET /fetch-recent?count=N` — returns recent gas samples; source will be `mock` or `rpc` depending on `USE_REAL_DATA`.
- `POST /ai-predict` — calls OpenAI (if available) or falls back to a local heuristic.

Hardhat deploy (local / testnet)

- The `deploy/` folder contains a minimal Hardhat project and scripts. Two useful commands (from `deploy/`):

```powershell
# install deps
cd deploy
npm ci

# deploy to a local Hardhat node (no keys needed)
npx hardhat run --network localhost scripts/deploy.js

# deploy to Arbitrum Goerli (requires deploy/.env with GOERLI_RPC_URL and DEPLOYER_KEY)
npm run deploy:goerli
```

Security and git

- A top-level `.gitignore` was added to exclude `node_modules/`, Python venvs, `.env` files and Hardhat artifacts. Add your local `.env` files (e.g. `deploy/.env`, `backend/.env`) and never commit private keys.

Notes, troubleshooting, and tips

- If `/fetch-recent` returns `"source":"rpc"` but with empty or tiny values, check `RPC_URL` and network availability.
- To force mock data, set `USE_REAL_DATA=0` before starting the backend (service restart required to pick up env changes).
- The AI integration is optional — when `OPENAI_API_KEY` is not set the `/ai-predict` endpoint returns a heuristic summary.

If you'd like, I can:
- Run the demo locally with simulated data and return screenshots / console outputs.
- Help you create a `deploy/.env` safely (I will not ask you to paste private keys in chat).


