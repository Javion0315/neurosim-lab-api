# Neural Network API

`POST /api/network`, Content-Type `application/json`. A body of `{}` selects defaults. The local import path remains `backend.app.main:app` from the repository root, or `app.main:app` from `backend/` (Vercel service root).

## Request

| Field | Default | Accepted range |
| --- | --- | --- |
| neuron_count | 100 | integer 20-200 |
| excitatory_fraction | 0.8 | 0.5-0.9 |
| connection_probability | 0.1 | 0-0.3 |
| excitatory_weight_mv | 0.5 | 0-2 mV |
| inhibitory_weight_mv | 2 | 0-8 mV, positive magnitude |
| external_drive_mv | 22 | 0-40 mV |
| duration_ms | 500 | integer 50-1000 ms, multiple of 5 |
| seed | 42 | integer 0-4294967295 |

Additional bound: `neuron_count * duration_ms <= 100000`. Unknown fields, non-finite values, and invalid ranges are rejected with HTTP 422. Integer fields reject booleans and fractional values. Both populations are always nonempty. The inhibitory fraction is derived, not an independent input.

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:8000/api/network' -ContentType 'application/json' -Body '{}'
```

## Response

| Fields | Meaning |
| --- | --- |
| kind | Always `simulation` |
| model_name, software_version | Human-readable model and application version |
| engine, engine_version, python_version, numpy_version | Environment metadata |
| dt_ms, execution_time_ms | Fixed 0.2 ms integration step; elapsed construction/run/summary time, excluding HTTP serialization |
| parameters | Complete validated request with defaults |
| populations | Total, E and I counts; actual E fraction; inclusive index ranges; directed connection count; adjacency SHA-256 |
| spike_times_ms, neuron_indices | Parallel arrays of all simulated spike events, ordered by time; zero-based IDs |
| rates | `bin_width_ms`, bin-center `time_ms`, `excitatory_hz`, `inhibitory_hz`, `total_hz` arrays |
| summary | `total_spikes`, per-neuron `mean_firing_rate_hz`, E and I mean rates, `population_rate_cv` |
| synchrony_definition | Exact calculation and silence handling |

See `/docs` or `/openapi.json` on the backend for generated schemas. CV is JSON null for silence; it is never NaN or infinity. Spikes are not truncated or randomly subsampled.

## Runtime and deployment limits

- At most 500,000 neuron integration updates, 200 neurons, 5,000 timesteps, and 39,800 possible directed edges (normally many fewer, since p <= 0.3).
- Input noise has at most 100,000 float64 samples (0.8 MB); adjacency at most 40,000 booleans. No membrane trace matrix or connectivity matrix is returned.
- The 2 ms refractory period and work bound cap events at about 50,000; there are at most 200 rate bins. JSON remains bounded even when many neurons fire at the refractory limit.
- Cooperative 10-second budget checked before, during (approximately every 0.1 wall-clock seconds), and after Brian execution. It includes cold import/setup time but cannot forcibly interrupt import or preparation. This is not a hard operating-system timeout.
- One active network run per Python process. Busy or budget-exceeded requests return HTTP 503 with a clear message and Retry-After: 2. Simulation runs in FastAPI's worker thread pool; health and metadata routes do not acquire this lock.
- Brian2 loads lazily on the event-loop/main thread because version 2.10.1 registers a signal handler at import; the original server handler is restored immediately. This first import briefly blocks the event loop and is included in the reported cold-run timing. Subsequent simulation work runs in a worker thread. It uses NumPy runtime code objects, no runtime compiler, no persistent scientific state, and no disk cache required for computation. Library diagnostic logs may use the system temporary directory.
- The browser sends same-origin `/api/network` requests and has a 30-second request timeout. A client disconnect does not cancel an in-flight simulation; server-side bounds still apply.
- Existing Vercel Services routing stays intact: `/api/(.*)` reaches the backend first, and frontend paths follow. No new service or routing prefix is needed.

Local performance is not a Vercel SLA. Confirm cold starts, function bundle size, installed scientific dependencies, memory, and concurrency in a Vercel preview before production promotion. The test environment does not establish hosted Linux performance. Brian2/SymPy/Cython increase the Python dependency footprint even though the NumPy runtime does not compile code.


## Phase 3 comparison endpoint

POST /api/network/compare accepts an object with only the four optional
experimental fields below. Empty body object {} means the Reference preset.
The original POST /api/network request and response contract is unchanged.

| Field | Default | Allowed |
| --- | --- | --- |
| excitatory_weight_mv | 0.5 | 0 to 2 mV |
| inhibitory_weight_mv | 2 | 0 to 8 mV, positive magnitude |
| connection_probability | 0.1 | 0 to 0.3 |
| external_drive_mv | 22 | 0 to 40 mV |

For example: {"excitatory_weight_mv": 0.75}. Unknown fields (including seed,
size, fraction, and duration) and non-finite or out-of-range values return 422.
Both conditions fix size=100, fraction=0.8, duration=500, seed=42.

Response: kind="simulation", reference and experimental Condition objects,
changes (parameter/reference/experimental triples for actual differences only),
fixed_conditions explanation, and execution_time_ms for the entire pair.
Each Condition contains network (the unchanged Phase 2 NetworkResult) and
coordination (bin_width_ms, active_fraction, mean_active_fraction,
peak_active_fraction, definition). All activity is simulated. For identical
conditions the simulator executes once; both fields contain that result.

The existing lock is held across both simulations. Overlapping network or
comparison work returns 503 and Retry-After: 2. The existing cooperative
10-second budget includes both simulations and metric processing, with at most
100,000 neuron-ms total. Cold initialization is included in the endpoint timer
but cannot be interrupted mid-import. Response serialization and network transfer
are outside the cooperative simulator deadline.

Maximum theoretical combined spikes are approximately 50,000 (two 100-neuron,
500 ms runs with 2 ms refractoriness); actual bounded stress payloads are measured
in the Phase 3 report. There are 100 rate/participation bins per condition and no
voltage histories or connectivity matrices in the payload.

The initial frontend baseline uses this endpoint with {} and one shared promise.
Manual Phase 2 requests still use /api/network. No routing changes or new frontend
API origin are needed. See methodology.md for definitions and reproducibility.
