from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.science import LIFParameters, simulate_lif, spike_statistics, synthetic_demo


def test_no_drive_has_no_spikes() -> None:
    result = simulate_lif(LIFParameters(input_drive_mv=0))
    assert result.spike_times_ms == []
    assert all(value == -65 for value in result.voltage_mv)


def test_drive_spikes_and_refractory_period() -> None:
    result = simulate_lif(LIFParameters(input_drive_mv=30, refractory_ms=5))
    assert len(result.spike_times_ms) > 0
    assert all(b - a >= 5 for a, b in zip(result.spike_times_ms, result.spike_times_ms[1:]))
    assert result.statistics.spike_count == len(result.spike_times_ms)


def test_statistics_definition() -> None:
    stats = spike_statistics([10, 20, 30], 1000)
    assert stats.firing_rate_hz == 3
    assert stats.mean_isi_ms == 10
    assert stats.cv_isi == 0


def test_demo_is_deterministic_and_labeled() -> None:
    assert synthetic_demo() == synthetic_demo()
    assert synthetic_demo().kind == "synthetic_demo"


def test_api_validation() -> None:
    client = TestClient(app)
    assert client.get("/api/health").status_code == 200
    assert client.post("/api/lif", json={"v_threshold_mv": -80}).status_code == 422
