# Phase 3 implementation and verification report

Verified locally on 2026-10-05. Phase 3 is implemented and locally verified.
No deployment was performed. Phase 4 was not implemented.

## 1. Files added and modified

| File | Change |
| --- | --- |
| backend/app/dynamics.py | New constrained comparison schema, shared simulator orchestration, distinct-neuron participation |
| backend/app/main.py | Add POST /api/network/compare using the existing worker/503 convention |
| frontend/components/network-client.ts | Extract unchanged types/defaults; serialize requests; deduplicate/cache initial reference |
| frontend/components/NetworkLab.tsx | Automatic loading, shared request client, reusable results with optional common rate scale |
| frontend/components/DynamicsLab.tsx | New educational experiment controls, presets, comparisons, participation plots, limitations |
| frontend/components/ResearchRoadmap.tsx | Level 3 implemented; Level 4 next; include Level 4 in compact roadmap |
| frontend/app/page.tsx | Integrate and link Phase 3; update current phase and roadmap copy |
| frontend/app/research-vision/page.tsx | Update implemented/next levels; retain research vision |
| tests/test_dynamics.py | 28 additional parametrized Python cases |
| tests/browser_phase3.cjs | Real frontend/backend browser regression |
| tests/benchmark_dynamics.py | Reproducible cold/warm/preset/stress benchmark |
| docs/methodology.md | Scientific question, metric definitions, comparison, assumptions, limitations |
| docs/network-api.md | New comparison request, response, and safety limits |
| docs/reproducibility.md | Matched randomness and baseline strategy; current test results |
| README.md | Current functionality, autoload, Phase 3, next milestone |
| docs/phase3-report.md | This report |

No application dependency was added or upgraded. Build-generated next-env.d.ts and
tsconfig.tsbuildinfo changes were restored to their pre-task content.

Unchanged: the complete backend/app/network.py simulator, Phase 1 science code,
DANDI provider, all existing tests, requirements, backend Python selection,
vercel.json, frontend/next.config.ts, and the shared Plotly Chart component.
The existing Single Neuron Lab, synthetic demo, DANDI explorer, Computational
Workflow, Research Vision, and scientific transparency labels remain available.

## 2. Inspection and Phase 2 scientific baseline

The existing architecture is Next.js/React/TypeScript/Tailwind with a shared
client-loaded Plotly basic chart, backed by FastAPI/Pydantic and a Brian2 NumPy
runtime. Network requests initialize Brian2 on the main thread before dispatch
to a worker, preserving the server's SIGINT handler. The process-global Brian
runtime uses a nonblocking lock, HTTP 503 for contention, and a cooperative
10-second budget. Phase 2 limits N*duration_ms to 100,000.

The inspected neuron equation, unchanged, is:

    dv/dt = (-(v + 65 mV) + drive + noise_i(t)) / (20 ms)

Euler dt=0.2 ms; threshold=-50 mV; reset/rest=-65 mV; refractory=2 ms.
Synapses are delayed instantaneous voltage jumps, delay=1 ms: +w_E or -w_I,
with incoming jumps ignored while voltage is refractory. There is no conductance
kernel, adaptation, plasticity, or intrinsic bursting mechanism. Directed
connections exclude self-edges and use unnormalized weights.

External noise is independent Gaussian input-drive noise, SD=4 mV, sampled every
1 ms and held between samples. Initial voltage is uniform [-65,-50) mV.
One seed spawns separate streams for adjacency, noise, and starting voltage.

Defaults remain N=100, excitatory_fraction=0.8, p=0.1, w_E=0.5 mV,
w_I=2 mV, drive=22 mV, duration=500 ms, seed=42.
Population-rate CV is std(total_hz, ddof=0)/mean(total_hz) over all 5 ms bins,
including empty bins and initialization; null for silence.

Before and after changes, the default on the Python 3.13 environment produced:
2,037 spikes, mean=40.74 Hz/neuron, E=40.425 Hz, I=42 Hz,
CV=0.28932152418560525. The full response JSON excluding execution_time_ms
has the same SHA-256 before and after:

    9b5819241cc32e916969d922d40b0f94bf1c390d918530ccd3d3dc65147127ff

This checksum includes environment metadata and is a local regression observation,
not a cross-version guarantee. The baseline autoload regression compares actual
responses instead of hardcoding these numbers.

## 3. Baseline autoload implementation

Both mounted labs call loadBaseline(), a shared module-scoped promise for
POST /api/network/compare with {}. The reference preset executes the existing
simulator once and reuses its result for both conditions. Phase 2 displays that
exact reference.network. No separate hidden baseline model or invented output
exists; no precomputed dataset is used.

The request is deduplicated across both consumers, re-renders, and Strict Mode
effect lifecycles. Each effect ignores results after cleanup without aborting the
other consumer's work. Loading states are visible and inputs disabled.
Successful initial results remain cached for the module lifetime; reload refreshes
them. Failed initial promises are evicted, and each Run button retries its endpoint.

Manual Phase 2 runs continue to POST /api/network using all eight visible controls.
The browser and backend regression tests prove unchanged manual defaults match
autoloaded output except runtime. Per-tab serialization avoids simultaneous
requests from the two labs; it does not hide server contention with other clients.
Fetch timeout is 30 seconds and does not cancel work already running on the server.

## 4. Phase 3 architecture, model, and upgrade decision

dynamics.py calls the original network._simulate implementation under the same
runtime lock; it does not duplicate the solver. Both conditions share the original
10-second cooperative deadline. Identical parameters run once; changed conditions
run the reference and experiment sequentially.

Phase 3 fixes N=100, fraction=0.8, duration=500, seed=42. Its four-field schema
rejects attempts to alter those fixed settings. The original network schema,
bounds, response, and manual endpoint are preserved.

The LIF model remains sufficient for these educational comparisons of activity,
temporal variability and co-activity. It has not established robust biologically
meaningful bursting, seizure onset, or clinically meaningful state transitions.
No AdEx/Izhikevich or other model option was added. No forced dramatic outcomes,
intrinsic bursting claims, or arbitrary clinical regime regions are used.

The UI follows Learn / Experiment / Observe / Explain / Research, encourages
one-variable and intermediate-value experiments, and warns when several fields
differ. An output difference alone does not demonstrate a qualitative transition.

## 5. Presets and exact changes

Every preset resets the other fields to the reference.

| Preset | Sole change |
| --- | --- |
| Reference | None |
| Increased excitation | excitatory_weight_mv: 0.5 -> 0.75 mV/spike (+50%) |
| Reduced inhibition | inhibitory_weight_mv: 2 -> 1 mV/spike (-50% magnitude) |
| Increased connectivity | connection_probability: 0.10 -> 0.15 (+50%) |
| Increased external drive | external_drive_mv: 22 -> 26 mV (+4 mV) |

These modest arithmetic manipulations were chosen transparently, not optimized to
force a seizure-like appearance. Exact pending and completed changes are shown.
Experiments are not labeled as patients, diseases, treatment, or seizure intensity.

## 6. Synchronization and coordination measures

Population-rate CV is preserved without modification. It describes temporal
population-count variability, is unbounded above, and is undefined for silence.
Sparse firing, bin width, startup and population size affect its interpretation.

The new temporal population participation is:

    a[k] = number of distinct neurons with >=1 spike in bin k / N
    mean_active_fraction = mean(a[k])
    peak_active_fraction = max(a[k])

Bins are non-overlapping, left-inclusive/right-exclusive 5 ms windows aligned with
the existing rates. Each neuron counts once per bin regardless of repeat spikes.
The sequence and both summaries are in [0,1], including zero for silence.
A K*N boolean occupancy array costs O(spikes + N*K), only 10,000 occupancy entries
for Phase 3. No expensive all-pairs correlation is used.

Higher a[k] means more neurons active in the same short window. It is not excess
synchrony above chance: high independently generated firing can also produce high
participation. Mean participation may be redundant with rate, particularly at low
rates. Peak participation can reflect one transient. Bin width/alignment, rate,
size, observation length and startup affect interpretation. No significance,
chance correction, or seizure score is implied.

The UI explicitly states: no single synchronization metric determines whether a
biological seizure is occurring.

## 7. Bursting and measured regime interpretation

No burst detector, burst threshold, or burst annotations are introduced.
The UI explains that peaks are measured activity, not automatically bursts.
A population burst would require an explicit defensible event definition and
validation; the current LIF model has not demonstrated robust biologically
meaningful bursting.

Matched rasters and E/I rates use common time/neuron axes and a shared rate scale.
A table compares mean, E and I firing rates, CV, mean participation, and peak
participation, including experimental-minus-reference differences.
Participation traces overlay on a fixed [0,1] axis. Relative rate/participation
interpretation replaces clinical region labels or thresholds.

## 8. Reproducibility and API

New endpoint: POST /api/network/compare. Only four optional experimental fields
are accepted; defaults and ranges match Phase 2. NaN/Infinity, out-of-range values,
unknown fields and attempts to modify fixed settings return 422.
Contention/runtime limits return 503 with Retry-After: 2.

Response includes kind="simulation", reference and experimental conditions,
actual parameter changes, fixed_conditions, and execution_time_ms for the pair.
Each condition contains the complete unchanged NetworkResult plus coordination.
Nested NetworkResult timing is elapsed from the shared request start; the second
condition's timing therefore includes the preceding reference work. Scientific
equality always excludes timing.

Matched initial voltages and input noise follow from identical stream seeds and
array shapes. Weight and drive experiments retain the same adjacency matrix.
Probability changes threshold the same uniform draws, producing nested edge sets
as p increases rather than resampling unrelated networks.
All parameters, environment metadata and connectivity hashes remain available.

## 9. Performance measurements

Local Windows/Python 3.13.15, Brian2 2.10.1, ASGI requests using httpx.
These times include response serialization but exclude external network transfer.
The cold case includes first Brian2 initialization; app import precedes timing.
Reproduce with python -B tests/benchmark_dynamics.py.

| Case | ASGI elapsed | JSON bytes | Experimental spikes |
| --- | ---: | ---: | ---: |
| Reference cold | 2,088.98 ms | 43,624 | 2,037 |
| Reference warm | 423.86 ms | 43,621 | 2,037 |
| Increased excitation | 873.08 ms | 45,821 | 2,283 |
| Reduced inhibition | 855.19 ms | 45,819 | 2,283 |
| Increased connectivity | 871.68 ms | 43,510 | 2,017 |
| Increased drive | 861.65 ms | 48,798 | 2,626 |
| Bounded stress, not a preset | 852.35 ms | 206,769 | 20,768 |

Stress uses maximum permitted excitation=2, p=0.3, drive=40 and inhibition=0.
It tests resource bounds; its 415.36 Hz mean and participation=1 are not seizure
evidence or a scientifically recommended condition.

Observed preset measurements, not expected universal relationships:

| Experiment | Mean Hz/neuron | Rate CV | Peak participation |
| --- | ---: | ---: | ---: |
| Reference | 40.74 | 0.2893 | 0.35 |
| Increased excitation | 45.66 | 0.3323 | 0.46 |
| Reduced inhibition | 45.66 | 0.2886 | 0.38 |
| Increased connectivity | 40.34 | 0.3898 | 0.53 |
| Increased drive | 52.52 | 0.2522 | 0.41 |

For example, increased connectivity raised variability and peak participation
while slightly lowering mean rate. Increased drive raised rate while lowering CV.
This illustrates why measurements should be read together, not reduced to a
single clinical score. One seed and a 500 ms run do not establish general results.

A comparison runs at most 100,000 neuron-ms total, matching Phase 2's original
maximum request budget. No voltage history or connection matrix is returned.
The process lock and cooperative 10-second deadline remain; these are not hard
OS timeouts and cannot preempt an import in progress.

## 10. Tests added

28 new parametrized Python cases cover:

- API autoload versus manual-default equivalence and reproducible references.
- Exact one-parameter preset differences and unchanged/nested connectivity.
- Deterministic experiments, including multiple explicitly changed parameters.
- Hand-computed participation, repeat spikes, bin boundaries, silence and full participation.
- Finite values, bounds, matching dimensions, spike times and neuron indices.
- Invalid/out-of-range/non-finite/uncontrolled parameter rejection.
- Single execution for identical conditions; lock and deadline shared by a pair.
- Work bound, busy response, runtime failure and exception cleanup.

Existing tests were not edited. No test requires reduced inhibition to cause a
seizure or asserts any clinical conclusion.

tests/browser_phase3.cjs uses the real production frontend and backend. It checks
loading before release of an initial request, exactly one shared network request,
manual-default equality, no API work on draft edits, exact plotted spike/rate/
participation data, shared axes, metrics, stale messaging, Phase 1 interaction,
Phase 2 bounds and silence, mobile width and initial-503 recovery. DANDI browser
rendering uses clearly labeled fixture metadata; live access was checked separately.

## 11. Full pytest results

- Python 3.13.15: **67 passed in 17.19 seconds**.
- Python 3.12.14: **67 passed in 28.76 seconds**.
- Command: python -B -m pytest tests -p no:cacheprovider.
- 39 existing cases plus 28 new cases.

The first new regression assertion compared Python tuples with JSON lists; its
serialization comparison was corrected. Automatic and manual API responses already
matched. The old temporary 3.12 environment had a broken launcher; a clean temporary
3.12 environment was created using the available interpreter and cached dependencies.
No repository dependency or Python selection was changed to accommodate testing.

## 12. Frontend, browser and integration results

- npm run lint: **passed**.
- npm run typecheck: **passed**.
- VERCEL=1 npm run build: **passed**, both application pages prerendered.
- Headless Edge production regression: **passed**, no page JavaScript errors.
- 1440 px desktop comparison inspected; 390 px mobile has no document overflow.
- Real HTTP health: **200**.
- Live DANDI electrophysiology search: **200**, five metadata records.
- Existing API/science/provider/routing/config files confirmed unchanged.
- Production rewrite manifest contains no local backend rewrite.
- No localhost/127.0.0.1:8000 API origins found in browser source or built static assets.

Browser request interception mirrored Vercel's service routing to the real local
backend. This was not a hosted Vercel deployment test.

## 13. Scientific limitations

This model studies computational mechanisms that can produce seizure-like
population dynamics. It does not reproduce the full biological complexity of
epilepsy and cannot diagnose, predict, or represent an individual patient's seizures.

High firing rate alone is not a seizure. High synchronization alone is not a
seizure. Reduced inhibition alone is not epilepsy. A simulated population burst
is not automatically a biological seizure.

The model simplifies or omits realistic cell diversity, detailed ion channels,
spatial anatomy, heterogeneous synaptic dynamics, realistic cortical connectivity,
patient-specific parameters, seizure onset zones, extracellular field generation,
and EEG forward modeling. All results are simulated; rates are not EEG.
The fixed seed and short duration support controlled examples, not population-level
inference. No robust intrinsic bursting, biological validity, seizure prediction
or patient-specific interpretation has been established.

SIMULATED RESULT, REAL DATA (archive metadata), and FUTURE VALIDATION remain
explicitly distinguished in the UI and documentation.

## 14. Deployment concerns and Phase 4 readiness

The implementation is locally ready for deployment verification. Vercel routing,
Python 3.12 selection and application dependencies remain unchanged. Local timing
is comfortably within the cooperative budget; hosted Linux cold starts, memory,
provider duration limits, and multiple-client load still require a deployment
smoke test. Concurrent requests can return 503; retry behavior is visible.
No deployment was requested or performed.

**Technically ready to begin Phase 4 - Real EEG development: yes.** Existing
scientific boundaries, matched simulation API, tests and integration remain intact.
The next scientific milestone is real epilepsy electrophysiology with recording
selection, provenance, preprocessing, and a justified comparison/observation
model. Phase 4 itself, forecasting, clinical classification, intervention,
olfactory stimulation, and patient digital twins are not implemented.
