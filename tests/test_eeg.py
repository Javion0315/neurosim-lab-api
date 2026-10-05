import json
from hashlib import sha256

import numpy as np
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app import eeg

client = TestClient(app)
URL = "/api/eeg/recordings/chb01_03/analyze"


def payload(start=2986, end=3006, channels=None):
    return {"channels": channels or ["FP1-F7", "FP2-F8"], "windows": [{"start_s": start, "end_s": end}]}


def test_official_metadata_and_artifact():
    m = client.get("/api/eeg/recordings/chb01_03/metadata").json()
    assert m["sampling_hz"] == 256 and m["unit"] == "uV"
    assert m["annotation"] == {"start_s": 2996, "end_s": 3036, "label": "Dataset annotation"}
    assert m["source_recording"] == "chb01_03.edf"
    assert m["source_sha256"] == "4c4a95a9b4331aeaadadd538763eb2e735950d9aa615b85ee6246c784be8ae90"
    assert m["digital_samples_sha256"] == "ed1b04a5d7563e46bea84a8132c962c1e9a050fb94e08c895b23cdb8d2b26a02"
    assert sha256((eeg.DATA / "chb01-summary.txt").read_bytes()).hexdigest() == m["annotation_sha256"]
    assert len(m["channels"]) == 8
    assert client.get("/api/eeg/recordings").json()[0]["recording_id"] == "chb01_03"


def test_real_window_dimensions_features_and_provenance():
    response = client.post(URL, json=payload())
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "real_eeg"
    assert body["provenance"]["doi"] == "10.13026/C2K01R"
    w = body["windows"][0]
    assert w["sample_count"] == 5120
    assert w["time_s"][0] == 2986 and w["time_s"][-1] == 3006 - 1 / 256
    m, full = eeg.load_recording("chb01_03")
    for i, channel in enumerate(w["channels"]):
        x = np.array(channel["voltage_uv"])
        np.testing.assert_array_equal(x, full[0 if i == 0 else 4, 26 * 256:46 * 256])
        assert np.isfinite(list(channel["features"].values())).all()
        assert channel["features"] == eeg.features(x)
        assert len(channel["psd"]["frequency_hz"]) == 257
        assert channel["psd"]["frequency_hz"][-1] == 128
        assert channel["psd"]["segment_count"] == 19
    assert body == client.post(URL, json=payload()).json()


@pytest.mark.parametrize("start,end", [(2959,2970),(3070,3081),(3000,3000),(3000,2999),(2960,2991),(3000,3001),(2996.001,3000)])
def test_invalid_intervals(start,end):
    assert client.post(URL,json=payload(start,end)).status_code == 422


@pytest.mark.parametrize("channels", [["bad"], ["FP1-F7","FP1-F7"], ["FP1-F7"]*5, []])
def test_invalid_channels(channels):
    p=payload(); p["channels"]=channels
    assert client.post(URL,json=p).status_code == 422


def test_invalid_id_and_unknown_fields():
    assert client.post("/api/eeg/recordings/not-a-recording/analyze",json=payload()).status_code == 404
    assert client.post(URL,json={**payload(), "path":"arbitrary.edf"}).status_code == 422
    assert client.post(URL,json={**payload(), "windows":[]}).status_code == 422


def test_equal_duration_comparison_and_bounds():
    p=payload(2960,2990)
    p["windows"].append({"start_s":3050,"end_s":3080})
    r=client.post(URL,json=p)
    assert r.status_code == 200 and len(r.json()["windows"]) == 2
    p["windows"][1]["end_s"]=3079
    assert client.post(URL,json=p).status_code == 422


def test_calibration_matches_known_edf_extrema():
    m, samples=eeg.load_recording("chb01_03")
    c=m["channels"][0]
    assert c["physical_min"] == -800 and c["physical_max"] == 800
    assert c["digital_min"] == -2048 and c["digital_max"] == 2047
    assert np.max(np.abs(samples)) <= 800


def test_feature_definitions():
    assert eeg.features(np.array([1.,-1.,3.])) == pytest.approx({
        "mean_uv":1., "variance_uv2":8/3, "rms_uv":np.sqrt(11/3),
        "line_length_uv":6., "peak_to_peak_uv":4.})


def test_welch_density_sinusoid_and_dc():
    # An analytical test signal verifies the estimator; never served as real EEG.
    x=3*np.sin(2*np.pi*12*np.arange(2560)/256)+17
    psd=eeg.welch(x,256)
    density=np.array(psd["density_uv2_per_hz"])
    assert psd["frequency_hz"][np.argmax(density)] == 12
    assert density.sum()*0.5 == pytest.approx(4.5,rel=1e-10)
    assert max(eeg.welch(np.ones(512)*17,256)["density_uv2_per_hz"]) == 0


@pytest.mark.parametrize("corrupt", [False,True])
def test_missing_or_corrupt_data_fails_explicitly(tmp_path,monkeypatch,corrupt):
    eeg.load_recording.cache_clear()
    if corrupt:
        m=json.loads((eeg.DATA/"chb01_03.json").read_text())
        (tmp_path/"chb01_03.json").write_text(json.dumps(m))
        (tmp_path/m["artifact"]).write_bytes(b"corrupt")
    monkeypatch.setattr(eeg,"DATA",tmp_path)
    try:
        response=client.post(URL,json=payload())
        assert response.status_code == 503
        assert "No synthetic replacement" in response.json()["detail"]
        assert "windows" not in response.json()
    finally:
        eeg.load_recording.cache_clear()
