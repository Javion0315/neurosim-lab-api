"""Bounded real EEG extraction and descriptive analysis; never generates EEG."""
from functools import lru_cache
from hashlib import sha256
from io import BytesIO
import json
from zipfile import BadZipFile
from pathlib import Path

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

DATA = Path(__file__).with_name("eeg_data")
REGISTRY = {"chb01_03": ("chb01_03.json", "chb01_03_2960_3080.npz")}
router = APIRouter(prefix="/api/eeg", tags=["Real EEG"])


class Window(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    start_s: float
    end_s: float


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    channels: list[str] = Field(min_length=1, max_length=4)
    windows: list[Window] = Field(min_length=1, max_length=2)


@lru_cache(maxsize=8)
def load_recording(recording_id: str):
    if recording_id not in REGISTRY:
        raise HTTPException(404, "Unknown EEG recording")
    metadata_name, artifact_name = REGISTRY[recording_id]
    try:
        metadata = json.loads((DATA / metadata_name).read_text(encoding="utf-8"))
        artifact = DATA / artifact_name
        if artifact.stat().st_size > 2_000_000:
            raise ValueError("Artifact too large")
        content = artifact.read_bytes()
        if sha256(content).hexdigest() != metadata["artifact_sha256"]:
            raise ValueError("Artifact checksum mismatch")
        with np.load(BytesIO(content), allow_pickle=False) as archive:
            digital = archive["digital"]
        if digital.dtype != np.dtype("<i2") or digital.shape != (len(metadata["channels"]), metadata["samples_per_channel"]):
            raise ValueError("Invalid sample shape or type")
        if sha256(digital.tobytes()).hexdigest() != metadata["digital_samples_sha256"]:
            raise ValueError("Sample checksum mismatch")
        if metadata["recording_id"] != recording_id or metadata["unit"] != "uV" or metadata["sampling_hz"] <= 0:
            raise ValueError("Invalid metadata")
        if (metadata["stored_end_s"] - metadata["stored_start_s"]) * metadata["sampling_hz"] != digital.shape[1]:
            raise ValueError("Invalid interval")
        rows = []
        for row, channel in zip(digital, metadata["channels"]):
            scale = (channel["physical_max"] - channel["physical_min"]) / (channel["digital_max"] - channel["digital_min"])
            rows.append((row.astype(np.float64) - channel["digital_min"]) * scale + channel["physical_min"])
        signals = np.stack(rows)
        if not np.isfinite(signals).all():
            raise ValueError("Non-finite EEG")
        signals.setflags(write=False)
        return metadata, signals
    except (OSError, ValueError, KeyError, TypeError, ZeroDivisionError, BadZipFile, EOFError) as exc:
        raise HTTPException(503, "Real EEG artifact unavailable or invalid. No synthetic replacement is provided.") from exc


def features(x: np.ndarray) -> dict:
    return {"mean_uv": float(np.mean(x)), "variance_uv2": float(np.var(x)),
            "rms_uv": float(np.sqrt(np.mean(x * x))),
            "line_length_uv": float(np.sum(np.abs(np.diff(x)))),
            "peak_to_peak_uv": float(np.ptp(x))}


def welch(x: np.ndarray, fs: int) -> dict:
    n = 2 * fs
    window = np.hanning(n + 1)[:-1]  # periodic Hann
    segments = np.lib.stride_tricks.sliding_window_view(x, n)[::n // 2]
    detrended = segments - segments.mean(axis=1, keepdims=True)
    power = np.abs(np.fft.rfft(detrended * window, axis=1)) ** 2 / (fs * np.sum(window ** 2))
    power[:, 1:-1] *= 2
    return {"frequency_hz": np.fft.rfftfreq(n, 1 / fs).tolist(),
            "density_uv2_per_hz": power.mean(axis=0).tolist(),
            "segment_count": len(segments)}


def analyze(recording_id: str, request: AnalysisRequest) -> dict:
    metadata, samples = load_recording(recording_id)
    names = [channel["name"] for channel in metadata["channels"]]
    if len(set(request.channels)) != len(request.channels) or any(c not in names for c in request.channels):
        raise HTTPException(422, "Select 1 to 4 distinct available channels")
    fs = metadata["sampling_hz"]
    windows = []
    lengths = []
    for requested in request.windows:
        start, end = requested.start_s, requested.end_s
        duration = end - start
        if not 2 <= duration <= 30 or start < metadata["stored_start_s"] or end > metadata["stored_end_s"]:
            raise HTTPException(422, "Windows must be 2 to 30 seconds and inside the stored interval")
        a, b = (start - metadata["stored_start_s"]) * fs, (end - metadata["stored_start_s"]) * fs
        if abs(a - round(a)) > 1e-7 or abs(b - round(b)) > 1e-7:
            raise HTTPException(422, "Window boundaries must align with the sampling grid")
        a, b = round(a), round(b)
        lengths.append(b - a)
        channels = []
        for name in request.channels:
            x = samples[names.index(name), a:b]
            channels.append({"name": name, "voltage_uv": x.tolist(), "features": features(x), "psd": welch(x, fs)})
        windows.append({"start_s": start, "end_s": end, "sample_count": b - a,
                        "time_s": (start + np.arange(b - a) / fs).tolist(), "channels": channels})
    if len(set(lengths)) != 1:
        raise HTTPException(422, "Comparison windows must have equal durations")
    return {"kind": "real_eeg", "provenance": metadata, "windows": windows,
            "analysis": {"minimum_duration_s": 2, "maximum_duration_s": 30, "maximum_channels": 4,
                         "interval_convention": "[start, end)", "visualization_downsampling": False,
                         "feature_variance_ddof": 0, "psd_method": "Welch", "sampling_hz": fs,
                         "segment_samples": 2 * fs, "overlap_samples": fs, "window": "periodic Hann",
                         "detrend": "segment mean (PSD only)", "nfft": 2 * fs, "frequency_bin_hz": 0.5,
                         "scaling": "one-sided density, uV^2/Hz", "average": "arithmetic mean"}}


@router.get("/recordings")
def recordings():
    return [{"recording_id": key, "source_recording": key + ".edf"} for key in REGISTRY]


@router.get("/recordings/{recording_id}/metadata")
def recording_metadata(recording_id: str):
    return load_recording(recording_id)[0]


@router.post("/recordings/{recording_id}/analyze")
def recording_analysis(recording_id: str, request: AnalysisRequest):
    return analyze(recording_id, request)
