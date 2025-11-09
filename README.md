# Gas Whisperer — AI-Powered Gas Fee Optimizer (demo)

This is a small demo scaffold that shows how an Arbitrum Stylus-style Rust contract (source included), a mocked AI backend, and a simple React frontend could work together to recommend gas prices.

Components:
- `rust_contract/` — Rust source (Cargo project) with an `optimize_gas` function demonstrating the logic you'd compile to WASM for Stylus.
- `backend/` — FastAPI mock service with endpoints:
  - `POST /optimize` — Returns suggested gas price, risk flag, and optimal timestamp.
  - `POST /explain` — Returns a plain-English explanation (mock).
  - `GET /gas-trend` — Returns a short gas trend message (mock).
- `data/gas.json` — Mocked recent block gas data.
- `frontend/index.html` — Minimal React UI (CDN) that calls the backend.

Quick run (Windows PowerShell):

1. Start backend (recommended in a venv):

```powershell
cd "I:/Subhash Imp Projects/AI-Powered Gas Fee Optimizer on Arbitrum Stylus/backend"
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

2. Open `frontend/index.html` in your browser (File -> Open) or serve it from a static server.

Notes:
- The Rust contract is provided as source; compiling to WASM for Stylus would be the next step when you have an Arbitrum Stylus toolchain.
- The backend uses the same gas-logic as the Rust example so results match.
 
Real data and AI integration
- To fetch real recent blocks from an Arbitrum RPC, set the `RPC_URL` env var and enable `USE_REAL_DATA=1` before starting the backend.
  Example (PowerShell):
```powershell
$env:RPC_URL = 'https://arb1.arbitrum.io/rpc'
$env:USE_REAL_DATA = '1'
$env:OPENAI_API_KEY = '<your-openai-key>'  # optional, for AI predictions
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
- New endpoints:
  - `GET /fetch-recent?count=20` — fetches recent gas points from RPC (if enabled) or returns the mock `data/gas.json`.
  - `POST /ai-predict?count=20` — calls OpenAI (if `OPENAI_API_KEY` is set) to return a short prediction, or falls back to a local heuristic.

  Note on API keys
  - `OPENAI_API_KEY` is read from the environment at runtime. Set it before starting the backend so the `/ai-predict` endpoint will use it. For testing you can also pass an `api_key` field in the JSON body of the `/ai-predict` POST but this is not recommended for production.

Notes:
- The backend will attempt to use the `web3` Python package to read recent blocks; install dependencies with `pip install -r requirements.txt` (I added `web3` and `openai`).
- The AI integration is optional and falls back to a simple heuristic when `OPENAI_API_KEY` or `openai` package is not available.

