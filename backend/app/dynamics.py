"""Matched Phase 3 experiments over the unchanged Phase 2 simulator."""
from time import perf_counter
from typing import Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field

from . import network
from .network import NetworkParameters, NetworkResult


class ExperimentParameters(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    excitatory_weight_mv: float = Field(default=0.5, ge=0, le=2)
    inhibitory_weight_mv: float = Field(default=2, ge=0, le=8)
    connection_probability: float = Field(default=0.1, ge=0, le=0.3)
    external_drive_mv: float = Field(default=22, ge=0, le=40)


class Coordination(BaseModel):
    bin_width_ms: int = network.BIN_MS
    active_fraction: list[float]
    mean_active_fraction: float
    peak_active_fraction: float
    definition: str = "a[k] = number of distinct neurons with >=1 spike in bin k / N; non-overlapping 5 ms bins"


class Condition(BaseModel):
    network: NetworkResult
    coordination: Coordination


class ParameterChange(BaseModel):
    parameter: str
    reference: float
    experimental: float


class ComparisonResult(BaseModel):
    kind: Literal["simulation"] = "simulation"
    reference: Condition
    experimental: Condition
    changes: list[ParameterChange]
    execution_time_ms: float
    fixed_conditions: str = (
        "100 neurons, 80 E / 20 I, 500 ms, seed 42, 0.2 ms Euler step; "
        "identical starting voltages and input-noise samples. Identical connectivity "
        "unless probability changes; then the same uniform draws define nested edge sets."
    )


def coordination(result: NetworkResult) -> Coordination:
    """O(spikes + N*bins); repeated spikes by one neuron count once per bin."""
    p = result.parameters
    active = np.zeros((p.duration_ms // network.BIN_MS, p.neuron_count), dtype=bool)
    bins = (np.asarray(result.spike_times_ms) // network.BIN_MS).astype(int)
    active[bins, np.asarray(result.neuron_indices, dtype=int)] = True
    fractions = active.mean(axis=1)
    return Coordination(
        active_fraction=fractions.tolist(),
        mean_active_fraction=float(fractions.mean()),
        peak_active_fraction=float(fractions.max()),
    )


def compare_network(parameters: ExperimentParameters, started: float | None = None) -> ComparisonResult:
    # The entire pair owns the Phase 2 lock and shares its existing runtime budget.
    if not network._runtime_lock.acquire(blocking=False):
        raise network.NetworkBusyError("A network simulation is running. Please retry shortly.")
    started = perf_counter() if started is None else started
    try:
        reference_params = NetworkParameters()
        experimental_params = NetworkParameters(**parameters.model_dump())
        reference = network._simulate(reference_params, started)
        experimental = reference if experimental_params == reference_params else network._simulate(experimental_params, started)
        ref = Condition(network=reference, coordination=coordination(reference))
        exp = ref if experimental is reference else Condition(network=experimental, coordination=coordination(experimental))
        changes = [
            ParameterChange(parameter=key, reference=getattr(reference_params, key), experimental=value)
            for key, value in parameters.model_dump().items()
            if value != getattr(reference_params, key)
        ]
        if perf_counter() - started > network.MAX_RUNTIME_SECONDS:
            raise network.NetworkRuntimeError("Network runtime budget exceeded. Try again shortly.")
        return ComparisonResult(
            reference=ref, experimental=exp, changes=changes,
            execution_time_ms=round((perf_counter() - started) * 1000, 3),
        )
    finally:
        network._runtime_lock.release()
