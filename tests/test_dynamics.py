"""Phase 3 computational invariants; none asserts a clinical outcome."""
import asyncio
import json
import math

import httpx
import numpy as np
import pytest

from backend.app import network
from backend.app.main import app
from backend.app.dynamics import ExperimentParameters, compare_network, coordination
from backend.app.network import NetworkParameters


def post(path, body):
    async def request():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.post(path, json=body)
    return asyncio.run(request())


def scientific(result):
    return result.model_dump(mode="json", exclude={"execution_time_ms"})


@pytest.fixture(scope="module")
def baseline():
    return compare_network(ExperimentParameters())


def test_auto_and_manual_default_baseline_are_identical(baseline):
    manual = post("/api/network", NetworkParameters().model_dump())
    automatic = post("/api/network/compare", {})
    assert manual.status_code == automatic.status_code == 200
    a = automatic.json()["reference"]["network"]
    b = manual.json()
    a.pop("execution_time_ms")
    b.pop("execution_time_ms")
    assert a == b == scientific(baseline.reference.network)
    assert baseline.changes == []
    assert baseline.reference == baseline.experimental


@pytest.mark.parametrize("key,value", [
    ("excitatory_weight_mv", 0.75), ("inhibitory_weight_mv", 1),
    ("connection_probability", 0.15), ("external_drive_mv", 26),
])
def test_presets_change_only_declared_parameter_and_reproduce_reference(baseline, key, value):
    result = compare_network(ExperimentParameters(**{key: value}))
    assert scientific(result.reference.network) == scientific(baseline.reference.network)
    r, e = result.reference.network, result.experimental.network
    changes = {k for k, v in r.parameters.model_dump().items() if v != getattr(e.parameters, k)}
    assert changes == {key}
    assert [c.model_dump() for c in result.changes] == [
        {"parameter": key, "reference": getattr(r.parameters, key), "experimental": value}
    ]
    if key != "connection_probability":
        assert r.populations.connectivity_sha256 == e.populations.connectivity_sha256
    else:
        # Same uniform draws and no self-edges, with nested connectivity sets.
        seed = np.random.SeedSequence(42).spawn(3)[0]
        draws = np.random.default_rng(seed).random((100, 100))
        low, high = draws < 0.1, draws < value
        np.fill_diagonal(low, False)
        np.fill_diagonal(high, False)
        assert np.all(~low | high)
        assert low.sum() == r.populations.connection_count
        assert high.sum() == e.populations.connection_count


def test_experimental_result_is_deterministic():
    p = ExperimentParameters(excitatory_weight_mv=0.75, external_drive_mv=26)
    a, b = compare_network(p), compare_network(p)
    assert scientific(a.experimental.network) == scientific(b.experimental.network)
    assert a.experimental.coordination == b.experimental.coordination
    assert len(a.changes) == 2


def test_metrics_count_distinct_neurons_and_obey_bin_edges(baseline):
    # Hand-constructed spike trains: duplicate spikes must not inflate participation.
    r = baseline.reference.network.model_copy(update={
        "parameters": NetworkParameters(neuron_count=20, duration_ms=50),
        "spike_times_ms": [0.0, 2.0, 4.8, 5.0, 49.8],
        "neuron_indices": [0, 0, 1, 2, 19],
    })
    metric = coordination(r)
    assert metric.active_fraction == [0.1, 0.05, 0, 0, 0, 0, 0, 0, 0, 0.05]
    assert metric.peak_active_fraction == 0.1
    assert metric.mean_active_fraction == pytest.approx(0.02)
    silent = coordination(r.model_copy(update={"spike_times_ms": [], "neuron_indices": []}))
    assert silent.active_fraction == [0] * 10
    assert silent.mean_active_fraction == silent.peak_active_fraction == 0
    simultaneous = coordination(r.model_copy(update={
        "spike_times_ms": [1.0] * 20, "neuron_indices": list(range(20)),
    }))
    assert simultaneous.peak_active_fraction == 1


@pytest.mark.parametrize("body", [
    {"neuron_count": 200}, {"duration_ms": 1000}, {"seed": 43}, {"excitatory_fraction": 0.9},
    {"excitatory_weight_mv": -0.1}, {"excitatory_weight_mv": 2.01},
    {"inhibitory_weight_mv": -1}, {"inhibitory_weight_mv": 8.01},
    {"connection_probability": -0.1}, {"connection_probability": 0.31},
    {"external_drive_mv": -1}, {"external_drive_mv": 40.01},
    {"external_drive_mv": "NaN"}, {"external_drive_mv": "Infinity"},
    {"external_drive_mv": None}, {"unknown": 1},
])
def test_comparison_api_rejects_invalid_or_uncontrolled_parameters(body):
    assert post("/api/network/compare", body).status_code == 422


@pytest.mark.parametrize("body", [
    {}, {"external_drive_mv": 0},
    {"connection_probability": 0.3, "excitatory_weight_mv": 2, "inhibitory_weight_mv": 0, "external_drive_mv": 40},
])
def test_comparison_api_output_integrity_and_metric_bounds(body):
    response = post("/api/network/compare", body)
    assert response.status_code == 200
    result = response.json()
    def finite(value):
        if isinstance(value, dict):
            return all(finite(v) for v in value.values())
        if isinstance(value, list):
            return all(finite(v) for v in value)
        return not isinstance(value, float) or math.isfinite(value)
    assert finite(result)
    json.dumps(result, allow_nan=False)
    for condition in (result["reference"], result["experimental"]):
        r, metric = condition["network"], condition["coordination"]
        assert len(r["spike_times_ms"]) == len(r["neuron_indices"]) == r["summary"]["total_spikes"]
        assert all(0 <= t < 500 for t in r["spike_times_ms"])
        assert all(0 <= i < 100 for i in r["neuron_indices"])
        assert r["spike_times_ms"] == sorted(r["spike_times_ms"])
        assert all(len(r["rates"][k]) == 100 for k in ["time_ms", "total_hz", "excitatory_hz", "inhibitory_hz"])
        assert len(metric["active_fraction"]) == 100
        assert all(0 <= a <= 1 for a in metric["active_fraction"])
        assert 0 <= metric["mean_active_fraction"] <= metric["peak_active_fraction"] <= 1
        assert metric["mean_active_fraction"] == pytest.approx(np.mean(metric["active_fraction"]))
        assert metric["peak_active_fraction"] == max(metric["active_fraction"])
    if body.get("external_drive_mv") == 0:
        assert result["experimental"]["network"]["summary"]["total_spikes"] == 0
        assert result["experimental"]["coordination"]["peak_active_fraction"] == 0


def test_reference_uses_one_simulation_and_pair_shares_lock_and_deadline(monkeypatch, baseline):
    calls = []
    def fake(parameters, started):
        assert network._runtime_lock.locked()
        calls.append((parameters, started))
        return baseline.reference.network.model_copy(update={"parameters": parameters})
    with monkeypatch.context() as m:
        m.setattr(network, "_simulate", fake)
        compare_network(ExperimentParameters())
        assert len(calls) == 1
        calls.clear()
        compare_network(ExperimentParameters(external_drive_mv=26))
        assert len(calls) == 2
        assert calls[0][1] == calls[1][1]
        assert sum(p.neuron_count * p.duration_ms for p, _ in calls) == 100_000
    assert not network._runtime_lock.locked()


def test_compare_busy_timeout_and_failure_release_lock(monkeypatch):
    with network._runtime_lock:
        busy = post("/api/network/compare", {})
    assert busy.status_code == 503
    assert busy.headers["retry-after"] == "2"
    with monkeypatch.context() as m:
        m.setattr(network, "MAX_RUNTIME_SECONDS", -1)
        assert post("/api/network/compare", {}).status_code == 503
    assert not network._runtime_lock.locked()
    def fail(*_):
        raise RuntimeError("injected failure")
    with monkeypatch.context() as m:
        m.setattr(network, "_simulate", fail)
        with pytest.raises(RuntimeError, match="injected"):
            compare_network(ExperimentParameters())
    assert not network._runtime_lock.locked()
    assert post("/api/network/compare", {}).status_code == 200
