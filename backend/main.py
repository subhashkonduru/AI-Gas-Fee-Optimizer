from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import json
import statistics
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend folder if present (allows storing OPENAI_API_KEY there)
env_path = Path(__file__).resolve().parent / '.env'
if env_path.exists():
    load_dotenv(env_path)

# Optional imports for real-chain and AI integration
try:
    from web3 import Web3
except Exception:
    Web3 = None

try:
    import openai
except Exception:
    openai = None

app = FastAPI(title="Gas Whisperer Mock API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = "../data/gas.json"
DEFAULT_RPC = os.getenv('RPC_URL', 'https://arb1.arbitrum.io/rpc')
USE_REAL = os.getenv('USE_REAL_DATA', '0') == '1'
OPENAI_KEY = os.getenv('OPENAI_API_KEY')
if OPENAI_KEY and openai:
    openai.api_key = OPENAI_KEY

class OptimizeRequest(BaseModel):
    tx: str
    current_gas: float

class OptimizeResponse(BaseModel):
    suggested_gas: float
    risk: bool
    optimal_time_iso: str
    reason: Optional[str] = None
    # seconds to wait from now until optimal_time (0 means send now)
    wait_seconds: Optional[int] = 0

class ExplainRequest(BaseModel):
    tx: str

@app.get("/gas-trend")
async def gas_trend():
    # Simple trend mock: if recent median is falling, say drop in 3 minutes
    with open(DATA_PATH) as f:
        d = json.load(f)
    gas_vals = [item["gas_gwei"] for item in d.get("recent", [])]
    if len(gas_vals) < 4:
        return {"message": "Not enough data"}
    # compare last half average vs first half average
    mid = len(gas_vals)//2
    first_avg = statistics.mean(gas_vals[:mid])
    last_avg = statistics.mean(gas_vals[mid:])
    if last_avg < first_avg:
        return {"message": "Gas is expected to drop in ~3 minutes"}
    elif last_avg > first_avg:
        return {"message": "Gas may rise in the next few minutes"}
    else:
        return {"message": "Gas likely stable for the next few minutes"}


def _block_to_point(block):
    # block may be a dict-like or an AttributeDict/object from web3
    fee = None
    ts = None
    try:
        # Try mapping access first (works for our local mock JSON)
        if isinstance(block, dict):
            if block.get('baseFeePerGas') is not None:
                fee = int(block.get('baseFeePerGas'))
            elif block.get('gasPrice') is not None:
                fee = int(block.get('gasPrice'))
            ts = block.get('timestamp')
        else:
            # web3 returns AttributeDict / object-like blocks; try attribute access
            bf = getattr(block, 'baseFeePerGas', None)
            gp = getattr(block, 'gasPrice', None)
            if bf is not None:
                fee = int(bf)
            elif gp is not None:
                fee = int(gp)
            # timestamp may be attribute or key
            ts = getattr(block, 'timestamp', None)
            if ts is None:
                # some providers return HexBytes for timestamp; try dict-like access as fallback
                try:
                    ts = block.get('timestamp')
                except Exception:
                    ts = None
    except Exception:
        fee = None
        ts = None

    if fee is None:
        return None

    # convert wei to gwei
    gwei = fee / 1e9
    try:
        ts_iso = datetime.utcfromtimestamp(int(ts)).isoformat() + 'Z'
    except Exception:
        ts_iso = datetime.utcnow().isoformat() + 'Z'
    return {"timestamp": ts_iso, "gas_gwei": round(gwei, 2)}


def fetch_recent_from_rpc(rpc_url: str = DEFAULT_RPC, count: int = 20):
    """Fetch recent `count` blocks from an RPC and return list of points {timestamp, gas_gwei} in chronological order."""
    if Web3 is None:
        raise RuntimeError('web3 package not installed')
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise RuntimeError(f'Could not connect to RPC: {rpc_url}')
    latest = w3.eth.block_number
    points = []
    start = max(0, latest - count + 1)
    for n in range(start, latest + 1):
        blk = w3.eth.get_block(n)
        p = _block_to_point(blk)
        if p:
            points.append(p)
    return points


@app.get('/fetch-recent')
async def fetch_recent(count: int = 20):
    """Return recent gas points from RPC (if enabled) or from local data file."""
    if USE_REAL:
        try:
            pts = fetch_recent_from_rpc(DEFAULT_RPC, count)
            return {"source": "rpc", "recent": pts}
        except Exception as e:
            # fall back to mock data
            print('RPC fetch failed:', e)
    with open(DATA_PATH) as f:
        d = json.load(f)
    return {"source": "mock", "recent": d.get("recent", [])}


class AIPredictRequest(BaseModel):
    count: int = 20
    api_key: Optional[str] = None


def _call_openai(prompt: str, api_key: str):
    # helper to call OpenAI and return text or raise
    if openai is None:
        raise RuntimeError('openai package not installed')
    prev = getattr(openai, 'api_key', None)
    try:
        openai.api_key = api_key
        resp = openai.Completion.create(model='text-davinci-003', prompt=prompt, max_tokens=60, temperature=0.0)
        return resp.choices[0].text.strip()
    finally:
        # restore previous key
        if prev is not None:
            openai.api_key = prev
        else:
            try:
                delattr(openai, 'api_key')
            except Exception:
                pass


@app.post('/ai-predict')
async def ai_predict(body: AIPredictRequest):
    """Use OpenAI (if configured) to give a short prediction based on recent gas points.
    The endpoint reads `OPENAI_API_KEY` env var by default. For testing you may pass `api_key` in the request body (not recommended for production).
    Falls back to a simple heuristic message if OpenAI isn't available or no key is configured."""
    # get recent points
    try:
        if USE_REAL:
            points = fetch_recent_from_rpc(DEFAULT_RPC, body.count)
        else:
            with open(DATA_PATH) as f:
                points = json.load(f).get('recent', [])
    except Exception:
        with open(DATA_PATH) as f:
            points = json.load(f).get('recent', [])

    vals = [p['gas_gwei'] for p in points]
    if not vals:
        return {"message": "Not enough data for prediction"}

    # If OpenAI is configured (env var) or api_key is provided in request, ask it for a short-term prediction
    effective_key = OPENAI_KEY
    if body.api_key:
        # request-provided api_key takes precedence for this call
        effective_key = body.api_key

    if openai and effective_key:
        prompt = f"Given recent block gas values in gwei: {vals}. Provide a one-line short-term (next 5 minutes) prediction and confidence percentage."
        try:
            text = _call_openai(prompt, effective_key)
            return {"message": text, "source": "openai"}
        except Exception as e:
            print('OpenAI request failed:', e)

    # fallback heuristic
    mid = len(vals)//2
    first_avg = statistics.mean(vals[:mid]) if mid>0 else statistics.mean(vals)
    last_avg = statistics.mean(vals[mid:])
    if last_avg < first_avg:
        return {"message": "Gas is expected to drop in ~3 minutes (heuristic)", "source": "heuristic"}
    elif last_avg > first_avg:
        return {"message": "Gas may rise in the next few minutes (heuristic)", "source": "heuristic"}
    else:
        return {"message": "Gas likely stable for the next few minutes (heuristic)", "source": "heuristic"}

@app.post("/explain")
async def explain(req: ExplainRequest):
    tx = req.tx.lower()
    # Extremely simple heuristic-based explanation mock
    if "swap" in tx or "uniswap" in tx or "sushi" in tx:
        return {"explanation": "You're swapping tokens (e.g., ETH → USDC) on a DEX such as Uniswap."}
    if "approve" in tx:
        return {"explanation": "This transaction approves a contract to spend your tokens."}
    if "transfer" in tx:
        return {"explanation": "This transfers tokens from one address to another."}
    return {"explanation": "Generic transaction — could be a contract call or token transfer."}

@app.post("/optimize", response_model=OptimizeResponse)
async def optimize(req: OptimizeRequest):
    # Load recent gas
    with open(DATA_PATH) as f:
        d = json.load(f)
    gas_vals = [item["gas_gwei"] for item in d.get("recent", [])]
    if not gas_vals:
        suggested = req.current_gas
        risk = False
        optimal_time = datetime.utcnow()
        reason = "No recent gas data"
    else:
        median = statistics.median(gas_vals)
        p90 = statistics.quantiles(gas_vals, n=100)[89] if len(gas_vals) >= 100 else sorted(gas_vals)[max(0,int(len(gas_vals)*0.9)-1)]
        # A simple suggestion: if current_gas higher than median, suggest median or slightly above
        if req.current_gas > median:
            suggested = max(median, req.current_gas * 0.9)
            reason = f"Current gas above median ({median} gwei). Suggest lowering toward median."
        else:
            suggested = max(req.current_gas, median * 0.9)
            reason = f"Current gas at or below median ({median} gwei)."
        risk = req.current_gas > p90
        # Determine an optimal time: if trend says drop, recommend now+3min else now
        mid = len(gas_vals)//2
        first_avg = statistics.mean(gas_vals[:mid]) if mid>0 else statistics.mean(gas_vals)
        last_avg = statistics.mean(gas_vals[mid:])
        if last_avg < first_avg:
            optimal_dt = datetime.utcnow() + timedelta(minutes=3)
        else:
            optimal_dt = datetime.utcnow()
        optimal_time = optimal_dt
        # compute wait seconds (non-negative)
        wait_seconds = max(0, int((optimal_dt - datetime.utcnow()).total_seconds()))
    return OptimizeResponse(
        suggested_gas=round(suggested, 2),
        risk=risk,
        optimal_time_iso=optimal_time.isoformat() + "Z",
        reason=reason,
        wait_seconds=wait_seconds
    )
