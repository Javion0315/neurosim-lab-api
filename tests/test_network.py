"""API boundaries, reproducibility, and computational (not biological) invariants."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import math
from pathlib import Path
import subprocess
import sys

import httpx
import numpy as np
import pytest

from backend.app.main import app
from backend.app import network
from backend.app.network import NetworkParameters, simulate_network


def post(body):
    async def request():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.post("/api/network", json=body)
    return asyncio.run(request())


@pytest.mark.parametrize("body", [
    {"neuron_count": 19}, {"neuron_count": 201}, {"neuron_count": 50.5},
    {"neuron_count": True}, {"excitatory_fraction": 0.49}, {"excitatory_fraction": 0.91},
    {"connection_probability": -0.1}, {"connection_probability": 0.31},
    {"duration_ms": 45}, {"duration_ms": 1005}, {"duration_ms": 51},
    {"neuron_count": 200, "duration_ms": 1000},
    {"excitatory_weight_mv": -1}, {"excitatory_weight_mv": 2.1},
    {"inhibitory_weight_mv": -1}, {"inhibitory_weight_mv": 8.1},
    {"external_drive_mv": -1}, {"external_drive_mv": 41},
    {"seed": -1}, {"seed": 4294967296}, {"seed": 1.2},
    {"external_drive_mv": "NaN"}, {"external_drive_mv": "Infinity"},
    {"unexpected": 1},
])
def test_api_rejects_invalid_or_unsafe_parameters(body):
    assert post(body).status_code == 422


@pytest.fixture(scope="module")
def result():
    return simulate_network(NetworkParameters(neuron_count=40, duration_ms=100))


def test_population_and_connection_construction(result):
    p = result.populations
    assert p.excitatory_count + p.inhibitory_count == p.neuron_count == 40
    assert p.excitatory_count == 32
    assert p.excitatory_index_range == (0, 31)
    assert p.inhibitory_index_range == (32, 39)
    assert 0 < p.connection_count <= 40 * 39


def test_determinism_even_after_other_seed_and_thread(result):
    simulate_network(result.parameters.model_copy(update={"seed": 99}))
    with ThreadPoolExecutor(max_workers=1) as pool:
        repeated = pool.submit(simulate_network, result.parameters).result()
    assert repeated.model_dump(exclude={"execution_time_ms"}) == result.model_dump(exclude={"execution_time_ms"})


def test_seed_changes_connectivity_and_activity(result):
    other = simulate_network(result.parameters.model_copy(update={"seed": 43}))
    assert other.populations.connectivity_sha256 != result.populations.connectivity_sha256
    assert (other.spike_times_ms, other.neuron_indices) != (result.spike_times_ms, result.neuron_indices)


def test_output_integrity_and_rate_definition(result):
    r = result
    assert len(r.spike_times_ms) == len(r.neuron_indices) == r.summary.total_spikes
    assert all(0 <= t < r.parameters.duration_ms for t in r.spike_times_ms)
    assert r.spike_times_ms == sorted(r.spike_times_ms)
    assert all(0 <= i < r.parameters.neuron_count for i in r.neuron_indices)
    rates = r.rates
    assert len(rates.time_ms) == len(rates.excitatory_hz) == len(rates.inhibitory_hz) == len(rates.total_hz) == 20
    edges = np.arange(0, 105, 5)
    counts = np.histogram(r.spike_times_ms, edges)[0]
    np.testing.assert_allclose(rates.total_hz, counts / (40 * 0.005))
    np.testing.assert_allclose(rates.total_hz, 0.8 * np.array(rates.excitatory_hz) + 0.2 * np.array(rates.inhibitory_hz))
    assert r.summary.mean_firing_rate_hz == pytest.approx(r.summary.total_spikes / (40 * 0.1))
    assert r.summary.population_rate_cv == pytest.approx(np.std(rates.total_hz) / np.mean(rates.total_hz))
    for neuron in range(40):
        train = [t for t, i in zip(r.spike_times_ms, r.neuron_indices) if i == neuron]
        assert all(interval >= 2 - 1e-6 for interval in np.diff(train))
    def finite(value):
        if isinstance(value, dict):
            return all(finite(v) for v in value.values())
        if isinstance(value, list):
            return all(finite(v) for v in value)
        return not isinstance(value, float) or math.isfinite(value)
    assert finite(json.loads(r.model_dump_json()))


def test_drive_increases_activity_without_recurrent_confound():
    settings = dict(neuron_count=20, duration_ms=100, connection_probability=0)
    low = simulate_network(NetworkParameters(**settings, external_drive_mv=0))
    high = simulate_network(NetworkParameters(**settings, external_drive_mv=35))
    assert low.populations.connection_count == high.populations.connection_count == 0
    assert high.summary.total_spikes > low.summary.total_spikes
    assert low.summary.total_spikes == 0
    assert low.summary.population_rate_cv is None
    assert all(rate == 0 for rate in low.rates.total_hz)


def test_fraction_rounding_and_minimum_populations():
    r = simulate_network(NetworkParameters(neuron_count=21, excitatory_fraction=0.5, duration_ms=50))
    assert (r.populations.excitatory_count, r.populations.inhibitory_count) == (11, 10)


def test_network_api_and_busy_response():
    response = post({"neuron_count": 20, "duration_ms": 50})
    assert response.status_code == 200
    assert response.json()["kind"] == "simulation"
    assert response.json()["engine_version"] == "2.10.1"
    with network._runtime_lock:
        busy = post({})
    assert busy.status_code == 503
    assert busy.headers["retry-after"] == "2"


def test_runtime_budget_releases_lock(monkeypatch):
    with monkeypatch.context() as m:
        m.setattr(network, "MAX_RUNTIME_SECONDS", -1)
        response = post({"neuron_count": 20, "duration_ms": 50})
    assert response.status_code == 503
    assert not network._runtime_lock.locked()
    assert post({"neuron_count": 20, "duration_ms": 50}).status_code == 200


def test_first_api_request_in_fresh_process():
    # Other tests import Brian on the main thread. A fresh process catches the
    # first-request SIGINT registration failure that warm in-process tests miss.
    code = """
import asyncio, signal, sys
import httpx
from backend.app.main import app
async def check():
    previous_handler = signal.getsignal(signal.SIGINT)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        assert (await client.get('/api/health')).status_code == 200
        assert 'brian2' not in sys.modules
        response = await client.post('/api/network', json={'neuron_count':20, 'duration_ms':50})
        assert response.status_code == 200, response.text
        assert response.json()['kind'] == 'simulation'
        assert signal.getsignal(signal.SIGINT) == previous_handler
asyncio.run(check())
"""
    completed = subprocess.run([sys.executable, "-B", "-c", code], cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True, timeout=30)
    assert completed.returncode == 0, completed.stdout + completed.stderr
