"""Run manually: python -B tests/benchmark_dynamics.py (repository root)."""
import asyncio
import json
from pathlib import Path
import sys
from time import perf_counter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from backend.app.main import app

CASES = [
    ("reference cold", {}),
    ("reference warm", {}),
    ("increased excitation", {"excitatory_weight_mv": 0.75}),
    ("reduced inhibition", {"inhibitory_weight_mv": 1}),
    ("increased connectivity", {"connection_probability": 0.15}),
    ("increased drive", {"external_drive_mv": 26}),
    ("bounded stress (not a preset)", {"excitatory_weight_mv": 2, "inhibitory_weight_mv": 0, "connection_probability": 0.3, "external_drive_mv": 40}),
]

async def main():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        for label, body in CASES:
            started = perf_counter()
            response = await client.post("/api/network/compare", json=body)
            elapsed = (perf_counter() - started) * 1000
            response.raise_for_status()
            r = response.json()
            e = r["experimental"]
            print(json.dumps({
                "case": label, "asgi_ms": round(elapsed, 2), "engine_pair_ms": r["execution_time_ms"],
                "json_bytes": len(response.content), "experimental_spikes": e["network"]["summary"]["total_spikes"],
                "mean_hz": e["network"]["summary"]["mean_firing_rate_hz"],
                "cv": e["network"]["summary"]["population_rate_cv"],
                "mean_active_fraction": e["coordination"]["mean_active_fraction"],
                "peak_active_fraction": e["coordination"]["peak_active_fraction"],
            }))

if __name__ == "__main__":
    asyncio.run(main())
