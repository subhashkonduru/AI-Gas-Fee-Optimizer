import sys
import pathlib
from fastapi.testclient import TestClient

# Ensure backend folder is on sys.path so tests can import main.py reliably
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from main import app

client = TestClient(app)

def test_optimize_shape_and_values():
    payload = {"tx":"swap 0.5 ETH to USDC on Uniswap","current_gas":12}
    r = client.post('/optimize', json=payload)
    assert r.status_code == 200
    j = r.json()
    # basic shape
    assert 'suggested_gas' in j and 'risk' in j and 'optimal_time_iso' in j
    # suggested_gas should be <= current gas when current gas > median (from mocked data median=11)
    assert j['suggested_gas'] <= 12
    # risk should be False for 12 gwei given mocked p90=14
    assert j['risk'] is False


def test_optimize_high_gas_flags_risk_true():
    # Use a high current gas value that is above the mocked p90 (p90 ~= 14 in data/gas.json)
    payload = {"tx": "large transfer", "current_gas": 20}
    r = client.post('/optimize', json=payload)
    assert r.status_code == 200
    j = r.json()
    assert j['risk'] is True
    # suggested gas should not be higher than current_gas (we only reduce or keep)
    assert j['suggested_gas'] <= 20
