"""Small, explicit scientific calculations used by Phase 1."""

from __future__ import annotations

from typing import Literal

import numpy as np
from pydantic import BaseModel, Field, model_validator


VERSION = "0.1.0"


class LIFParameters(BaseModel):
    input_drive_mv: float = Field(default=22, ge=-100, le=100)
    tau_m_ms: float = Field(default=20, gt=0, le=200)
    v_rest_mv: float = Field(default=-65, ge=-100, le=30)
    v_threshold_mv: float = Field(default=-50, ge=-100, le=50)
    v_reset_mv: float = Field(default=-65, ge=-100, le=30)
    refractory_ms: float = Field(default=2, ge=0, le=50)
    duration_ms: float = Field(default=500, ge=20, le=2000)
    seed: int = Field(default=42, ge=0, le=4294967295)

    @model_validator(mode="after")
    def check_voltages(self) -> "LIFParameters":
        if self.v_rest_mv >= self.v_threshold_mv or self.v_reset_mv >= self.v_threshold_mv:
            raise ValueError("Resting and reset potentials must be below threshold")
        return self


class SpikeStatistics(BaseModel):
    spike_count: int
    firing_rate_hz: float
    mean_isi_ms: float | None
    cv_isi: float | None


class LIFResult(BaseModel):
    kind: Literal["simulation"] = "simulation"
    model_name: str = "Leaky integrate-and-fire"
    software_version: str = VERSION
    dt_ms: float = 0.1
    parameters: LIFParameters
    time_ms: list[float]
    voltage_mv: list[float]
    spike_times_ms: list[float]
    statistics: SpikeStatistics


def spike_statistics(spikes_ms: list[float], duration_ms: float) -> SpikeStatistics:
    """Compute rate over the whole interval and ISI CV when defined."""
    intervals = np.diff(np.asarray(spikes_ms, dtype=float))
    mean_isi = float(np.mean(intervals)) if intervals.size else None
    cv = (
        float(np.std(intervals) / mean_isi)
        if intervals.size >= 2 and mean_isi is not None and mean_isi > 0
        else None
    )
    return SpikeStatistics(
        spike_count=len(spikes_ms),
        firing_rate_hz=round(len(spikes_ms) / (duration_ms / 1000), 3),
        mean_isi_ms=round(mean_isi, 3) if mean_isi is not None else None,
        cv_isi=round(cv, 3) if cv is not None else None,
    )


def simulate_lif(params: LIFParameters) -> LIFResult:
    """Forward Euler LIF with constant drive and absolute refractory period."""
    dt = 0.1
    times = np.arange(0, params.duration_ms + dt / 2, dt)
    voltage = np.empty(times.size, dtype=float)
    voltage[0] = params.v_rest_mv
    spikes: list[float] = []
    refractory_until = -1.0
    for i in range(1, times.size):
        t = float(times[i])
        if t < refractory_until - 1e-9:
            voltage[i] = params.v_reset_mv
            continue
        previous = voltage[i - 1]
        # Current is represented by its steady-state voltage drive R*I in mV.
        voltage[i] = previous + dt * (
            -(previous - params.v_rest_mv) + params.input_drive_mv
        ) / params.tau_m_ms
        if voltage[i] >= params.v_threshold_mv:
            spikes.append(round(t, 3))
            voltage[i] = params.v_reset_mv
            refractory_until = t + params.refractory_ms
    return LIFResult(
        parameters=params,
        time_ms=np.round(times, 3).tolist(),
        voltage_mv=np.round(voltage, 4).tolist(),
        spike_times_ms=spikes,
        statistics=spike_statistics(spikes, params.duration_ms),
    )


class DemoResult(BaseModel):
    kind: Literal["synthetic_demo"] = "synthetic_demo"
    model_name: str = "Independent Poisson spike trains"
    software_version: str = VERSION
    seed: int
    duration_ms: float
    rate_hz: float
    spike_trains_ms: list[list[float]]
    statistics: SpikeStatistics


def synthetic_demo(seed: int = 7, neurons: int = 12, duration_ms: float = 1000) -> DemoResult:
    """Independent Poisson processes; visualization only, never real data."""
    rng = np.random.default_rng(seed)
    rate_hz = 8.0
    trains: list[list[float]] = []
    for _ in range(neurons):
        t = 0.0
        train: list[float] = []
        while True:
            t += float(rng.exponential(1000 / rate_hz))
            if t >= duration_ms:
                break
            train.append(round(t, 3))
        trains.append(train)
    count = sum(map(len, trains))
    return DemoResult(
        seed=seed,
        duration_ms=duration_ms,
        rate_hz=rate_hz,
        spike_trains_ms=trains,
        # Per-neuron mean rate; pooled ISI across neurons is not meaningful.
        statistics=SpikeStatistics(
            spike_count=count,
            firing_rate_hz=round(count / neurons / (duration_ms / 1000), 3),
            mean_isi_ms=None,
            cv_isi=None,
        ),
    )
