# Reproducibility

The LIF response contains the complete input parameters, model name, software version, time step, simulation duration, voltage trace, spike times, and derived statistics. The seed is stored even though the deterministic Phase 1 LIF model does not consume randomness. The synthetic demo fixes seed 7 and exposes its rate and duration. API versions and scientific assumptions should be retained with future exports.


## Network simulations

Python 3.12 remains the production baseline in `backend/.python-version`. The compatibility policy is Python >=3.12,<3.14; Python 3.13 is also supported locally. The full 67-test suite passed locally on Python 3.12.14 and 3.13.15 (Windows) after Phase 3. No packaging infrastructure is added to express this policy. Brian2 is pinned to 2.10.1. Other existing dependency ranges remain unchanged, so record the complete environment (`python -m pip freeze`) for archived experiments.

A NumPy `SeedSequence(seed)` spawns three independent streams for directed connectivity, input noise, and initial voltages. There is no use of global NumPy or Brian random state. Each call constructs new simulation objects; a process-local nonblocking lock prevents simultaneous Brian runtime access. An overlapping request gets HTTP 503 and Retry-After: 2 instead of entering an unbounded simulation queue. The lock holds no scientific state and is released on errors.

With identical parameters in the same environment, all output except `execution_time_ms` is deterministic. Metadata records Python, NumPy, Brian2, application version, timestep, and all adjustable parameters. The connectivity SHA-256 hashes the row-major boolean adjacency matrix for comparisons without returning an expensive matrix. It is not a biological identifier.

Floating-point differences, numerical scheduling changes, random generator changes, and dependency/platform updates can alter results across environments. Do not require bitwise agreement across Python versions or platforms. Elapsed execution time is operational metadata and must be excluded from reproducibility comparisons.

See [network API](network-api.md) for limits and [methodology](methodology.md) for fixed parameters and event timing.


## Phase 3 matched comparisons and initial baseline

Reference uses the exact Phase 2 defaults, including seed 42. Comparisons expose
only four experimental parameters; size=100, fraction=0.8 and duration=500 remain
fixed. Initial voltages and input-noise arrays match between conditions.
Weights/drive preserve the adjacency matrix. A probability change thresholds
the same uniform draws, preserving nested edge sets. No randomness is used in
the participation calculation.

POST /api/network/compare with {} initializes both frontend labs from one actual
simulation; manual unchanged Phase 2 defaults via POST /api/network reproduce
the same scientific payload. Timing is excluded from equality checks. Successful
initial results are cached only in the current browser module, not as a hidden
baseline dataset. The backend does not cache simulations.

tests/test_dynamics.py verifies matched reference outputs, declared changes,
seeded determinism, bounds, metric definitions, API validation and resource
guards. tests/browser_phase3.cjs verifies the actual automatic/manual flow,
one initial network request, plots, error recovery and retained interactions.
Use Playwright available via NODE_PATH and running frontend/backend servers;
FRONTEND_URL, BACKEND_URL and BROWSER_CHANNEL can override local test defaults.
