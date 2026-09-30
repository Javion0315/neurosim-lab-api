"""Bounded, seeded E/I LIF network. Brian2 is loaded only on a network request."""
from __future__ import annotations

from functools import lru_cache
from hashlib import sha256
from threading import Lock
from time import perf_counter
from typing import Literal
import platform
import signal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field, model_validator

from .science import VERSION

DT_MS = 0.2
BIN_MS = 5
MAX_NEURON_MS = 100_000
MAX_RUNTIME_SECONDS = 10
_runtime_lock = Lock()


class NetworkBusyError(RuntimeError):
    pass


class NetworkRuntimeError(RuntimeError):
    pass


class NetworkParameters(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    neuron_count: int = Field(default=100, ge=20, le=200, strict=True)
    excitatory_fraction: float = Field(default=0.8, ge=0.5, le=0.9)
    connection_probability: float = Field(default=0.1, ge=0, le=0.3)
    excitatory_weight_mv: float = Field(default=0.5, ge=0, le=2)
    inhibitory_weight_mv: float = Field(default=2, ge=0, le=8)
    external_drive_mv: float = Field(default=22, ge=0, le=40)
    duration_ms: int = Field(default=500, ge=50, le=1000, multiple_of=5, strict=True)
    seed: int = Field(default=42, ge=0, le=4294967295, strict=True)

    @model_validator(mode="after")
    def bound_work(self) -> "NetworkParameters":
        if self.neuron_count * self.duration_ms > MAX_NEURON_MS:
            raise ValueError("neuron_count * duration_ms must not exceed 100000 neuron-ms")
        return self


class Populations(BaseModel):
    neuron_count: int
    excitatory_count: int
    inhibitory_count: int
    actual_excitatory_fraction: float
    excitatory_index_range: tuple[int, int]
    inhibitory_index_range: tuple[int, int]
    connection_count: int
    connectivity_sha256: str


class PopulationRates(BaseModel):
    bin_width_ms: int = BIN_MS
    time_ms: list[float]
    excitatory_hz: list[float]
    inhibitory_hz: list[float]
    total_hz: list[float]


class NetworkSummary(BaseModel):
    total_spikes: int
    mean_firing_rate_hz: float
    excitatory_mean_firing_rate_hz: float
    inhibitory_mean_firing_rate_hz: float
    population_rate_cv: float | None


class NetworkResult(BaseModel):
    kind: Literal["simulation"] = "simulation"
    model_name: str = "Recurrent excitatory-inhibitory LIF network"
    software_version: str = VERSION
    engine: str = "Brian2 / NumPy runtime"
    engine_version: str
    numpy_version: str = np.__version__
    python_version: str = platform.python_version()
    dt_ms: float = DT_MS
    execution_time_ms: float
    parameters: NetworkParameters
    populations: Populations
    spike_times_ms: list[float]
    neuron_indices: list[int]
    rates: PopulationRates
    summary: NetworkSummary
    synchrony_definition: str = "std(total_hz, ddof=0) / mean(total_hz), across all 5 ms bins; null for silence"


@lru_cache(maxsize=1)
def initialize_network_engine():
    # Brian2 2.10.1 registers SIGINT at import. The API calls this on the
    # event-loop/main thread before dispatching simulation to a worker.
    # Preserve the ASGI server's handler so Ctrl+C never returns partial runs.
    previous_handler = signal.getsignal(signal.SIGINT)
    try:
        import brian2
    finally:
        signal.signal(signal.SIGINT, previous_handler)
    return brian2


def simulate_network(params: NetworkParameters, started: float | None = None) -> NetworkResult:
    # Brian runtime construction/execution is process-global: reject overlapping
    # network requests rather than queueing them or mixing simulator state.
    if not _runtime_lock.acquire(blocking=False):
        raise NetworkBusyError("A network simulation is running. Please retry shortly.")
    started = perf_counter() if started is None else started
    try:
        return _simulate(params, started)
    finally:
        _runtime_lock.release()


def _simulate(params: NetworkParameters, started: float) -> NetworkResult:
    b = initialize_network_engine()

    n = params.neuron_count
    ne = int(n * params.excitatory_fraction + 0.5)
    ni = n - ne
    connectivity_seed, input_seed, voltage_seed = np.random.SeedSequence(params.seed).spawn(3)
    rng = np.random.default_rng(connectivity_seed)
    adjacency = rng.random((n, n)) < params.connection_probability
    np.fill_diagonal(adjacency, False)
    sources, targets = np.nonzero(adjacency)
    fingerprint = sha256(adjacency.tobytes()).hexdigest()
    # Independent samples every 1 ms, held constant between samples. No Brian
    # global random seed is needed: all randomness uses local NumPy generators.
    noise = np.random.default_rng(input_seed).normal(0, 4, (params.duration_ms, n))
    external_noise = b.TimedArray(noise * b.mV, dt=1 * b.ms)
    clock = b.Clock(dt=DT_MS * b.ms)
    neurons = b.NeuronGroup(
        n,
        "dv/dt = (-(v + 65*mV) + drive + external_noise(t, i)) / (20*ms) : volt (unless refractory)",
        threshold="v >= -50*mV", reset="v = -65*mV", refractory=2 * b.ms,
        method="euler", clock=clock, codeobj_class=b.NumpyCodeObject,
        namespace={"drive": params.external_drive_mv * b.mV, "external_noise": external_noise},
    )
    neurons.v = np.random.default_rng(voltage_seed).uniform(-65, -50, n) * b.mV
    synapses = b.Synapses(
        neurons, neurons, model="w : volt", on_pre="v_post += w",
        delay=1 * b.ms, clock=clock, codeobj_class=b.NumpyCodeObject,
    )
    if sources.size:
        synapses.connect(i=sources, j=targets)
        synapses.w = np.where(sources < ne, params.excitatory_weight_mv, -params.inhibitory_weight_mv) * b.mV
    else:
        synapses.active = False
    spikes = b.SpikeMonitor(neurons, codeobj_class=b.NumpyCodeObject)
    network = b.Network(neurons, synapses, spikes)

    def check_runtime(*_args: object) -> None:
        if perf_counter() - started > MAX_RUNTIME_SECONDS:
            raise NetworkRuntimeError("Network runtime budget exceeded. Try a smaller network or duration.")

    check_runtime()
    network.run(params.duration_ms * b.ms, namespace={}, report=check_runtime, report_period=0.1 * b.second)
    check_runtime()
    times = np.asarray(spikes.t / b.ms)
    indices = np.asarray(spikes.i, dtype=int)
    edges = np.arange(0, params.duration_ms + BIN_MS, BIN_MS)
    exc_counts = np.histogram(times[indices < ne], edges)[0]
    inh_counts = np.histogram(times[indices >= ne], edges)[0]
    exc_rates = exc_counts / (ne * BIN_MS / 1000)
    inh_rates = inh_counts / (ni * BIN_MS / 1000)
    total_rates = (exc_counts + inh_counts) / (n * BIN_MS / 1000)
    duration_s = params.duration_ms / 1000
    mean_rate = float(total_rates.mean())
    return NetworkResult(
        engine_version=b.__version__, execution_time_ms=round((perf_counter() - started) * 1000, 3),
        parameters=params,
        populations=Populations(
            neuron_count=n, excitatory_count=ne, inhibitory_count=ni,
            actual_excitatory_fraction=ne / n, excitatory_index_range=(0, ne - 1),
            inhibitory_index_range=(ne, n - 1), connection_count=len(sources), connectivity_sha256=fingerprint,
        ),
        spike_times_ms=np.round(times, 6).tolist(), neuron_indices=indices.tolist(),
        rates=PopulationRates(
            time_ms=((edges[:-1] + edges[1:]) / 2).tolist(),
            excitatory_hz=exc_rates.tolist(), inhibitory_hz=inh_rates.tolist(), total_hz=total_rates.tolist(),
        ),
        summary=NetworkSummary(
            total_spikes=len(times), mean_firing_rate_hz=len(times) / (n * duration_s),
            excitatory_mean_firing_rate_hz=int(exc_counts.sum()) / (ne * duration_s),
            inhibitory_mean_firing_rate_hz=int(inh_counts.sum()) / (ni * duration_s),
            population_rate_cv=float(total_rates.std(ddof=0) / mean_rate) if mean_rate > 0 else None,
        ),
    )
