# Phase 2 implementation and verification report

Verified locally on 2026-09-30. Phase 2 is implemented; Phase 3 has not been implemented or deployed.

## 1. Repository architecture discovered

The repository has a Next.js App Router frontend using React, TypeScript, Tailwind, and Plotly basic; a FastAPI backend with Pydantic models; and a root pytest suite. `backend/app/science.py` contains the existing fixed-step NumPy LIF solver, `spike_statistics`, and seeded synthetic Poisson demo. `backend/app/providers.py` provides DANDI metadata. API conventions are `/api/*`, GET for metadata and POST for validated simulation bodies. Existing tests covered science, API validation, and a mocked provider.

The application path is `backend.app.main:app` from the repository root, and `app.main:app` from the backend service root. Vercel Services routes `/api/(.*)` to the backend before frontend routes. Both `vercel.json` and `frontend/next.config.ts` are unchanged.

## 2. Files added or modified

| File | Change |
| --- | --- |
| backend/app/network.py | New bounded Brian2 model, schemas, metadata, rate/CV calculations, concurrency and runtime safeguards |
| backend/app/main.py | POST /api/network; main-thread lazy engine initialization, worker execution, HTTP 503 handling |
| backend/app/science.py | Application version 0.2.0 only; existing scientific algorithms unchanged |
| backend/requirements.txt | Pin Brian2 2.10.1 |
| tests/test_network.py | 33 new parametrized test cases |
| tests/test_science.py | Preserve existing assertions using httpx ASGI transport |
| frontend/components/NetworkLab.tsx | Controls, conceptual diagram, learning structure, simulated plots, metrics, interpretation, methodology |
| frontend/components/Chart.tsx | Shared Plotly chart extracted from the existing page, with optional legends and axis ranges |
| frontend/app/page.tsx | Integrate Network Lab after Single Neuron; navigation, phase and roadmap copy |
| frontend/components/ResearchRoadmap.tsx | Level 2 implemented; Level 3 next development stage |
| frontend/app/research-vision/page.tsx | Updated status text and Network Lab link |
| frontend/tailwind.config.ts | Scan components as well as app so shared UI classes are generated |
| README.md | Phase 2 overview, startup command, Python policy, network API and docs |
| docs/methodology.md | Equations, connectivity, input, synapses, rates, CV, assumptions and limitations |
| docs/reproducibility.md | Seeds, environment metadata and compatibility policy |
| docs/network-api.md | Request/response schemas, bounds, runtime and deployment behavior |
| docs/phase2-report.md | This report |

## 3. Dependencies added

The only direct application dependency added is `brian2==2.10.1`. Its installed supporting dependencies include SymPy, Cython, Jinja2, pyparsing, py-cpuinfo, setuptools, MarkupSafe, and mpmath. No frontend dependency or package lock change was needed. The NumPy runtime avoids compilation despite Brian2's Cython package dependency. Dependency consistency and requirements parsing passed.

Playwright and uv were installed only in temporary directories for browser verification and an isolated Python 3.12 environment. They are not project dependencies. The existing Python 3.13 virtual environment was retained.

## 4. Network model implemented

A recurrent directed E/I LIF network with no self-connections, Dale-like source signs, delayed instantaneous voltage-jump synapses, constant external drive plus seeded independent Gaussian fluctuations, and randomized initial voltages. Fixed constants: 20 ms membrane time constant, -65 mV rest/reset, -50 mV threshold, 2 ms refractory period, 1 ms synaptic delay, 0.2 ms Euler step, input-noise standard deviation 4 mV sampled every 1 ms. There is no plasticity or anatomical model.

Brian2 is imported lazily on the main event-loop thread because 2.10.1 registers a signal handler during import. The original server handler is restored, and simulation then runs in FastAPI's worker pool. A fresh-process regression test covers this otherwise easily missed cold-start behavior.

## 5-6. Defaults and adjustable parameters

All eight parameters below are editable. Inhibitory fraction is derived automatically.

| Parameter | Default | Limits |
| --- | --- | --- |
| Neuron count | 100 (80 E / 20 I) | 20-200 |
| Excitatory fraction | 0.8 | 0.5-0.9 |
| Directed connection probability | 0.1 | 0-0.3 |
| Excitatory synaptic weight | 0.5 mV | 0-2 mV |
| Inhibitory synaptic magnitude | 2 mV | 0-8 mV |
| External drive | 22 mV | 0-40 mV |
| Duration | 500 ms | 50-1000 ms in 5 ms increments |
| Seed | 42 | Integer 0-4294967295 |

The rounded excitatory count is `floor(N * fraction + 0.5)`; the remainder is inhibitory. The default 80/20 split is not claimed to be universal.

## 7. Synchronization metric

Population-rate CV is `std(r_total, ddof=0) / mean(r_total)`, where `r_total[k] = total spikes in bin k / (N * 0.005 seconds)`. All non-overlapping 5 ms bins are included, including startup and empty bins. CV is null for silence, dimensionless, and unbounded above. It measures temporal population-rate variability, not direct pairwise synchrony. Sparse firing, size, bin width, and shared input affect it. High synchronization is not automatically pathological.

## 8. API schema

`POST /api/network` accepts the eight validated fields above; `{}` selects defaults. The response includes `kind: simulation`, model/application/environment metadata, `parameters`, `populations`, parallel `spike_times_ms` and `neuron_indices`, binned E/I/total `rates`, `summary`, `synchrony_definition`, and `execution_time_ms`. Population metadata includes connection count, actual composition, zero-based inclusive index ranges, and an adjacency SHA-256. Full schema: [network-api.md](network-api.md), or the backend's generated `/docs`.

## 9. Performance limits and measurements

`N * duration_ms <= 100000`: at most 500,000 neuron integration updates, about 50,000 possible spike events given refractoriness, 200 rate bins, and 100,000 input-noise samples. No voltage-history or connectivity matrix is returned. One active simulation per process; overlapping calls return 503 with Retry-After. A cooperative 10-second budget includes cold setup but cannot preempt imports or preparation; it is not a hard OS timeout.

Observed on this Windows/Python 3.13 machine (not hosted benchmarks):

| Case | Elapsed time | JSON size |
| --- | --- | --- |
| Default, cold observations | Approximately 2.5-5.4 s | About 21 KB |
| Default, warm observations | Approximately 0.39-0.72 s | About 21 KB |
| 200 neurons, 500 ms, p=0.3, strong excitation | 0.45 s | 387,677 bytes |
| 100 neurons, 1000 ms, p=0.3, strong excitation | 0.65 s | 371,876 bytes |

The large cases produced about 41,600 events each. These are computational stress checks, not biological findings. Timings vary with load and exclude HTTP serialization. The browser has a 30-second request timeout; disconnecting does not cancel work already running on the backend.

## 10-11. Tests added and full pytest results

33 new cases cover range/finite/integer/unknown-field/work-budget validation, population construction and rounding, seeded determinism across requests and threads, seed sensitivity, spike and rate integrity, exact CV calculation, refractory intervals, silence, controlled external-drive response without recurrence, API success, busy handling, runtime failure cleanup, and first API use in a fresh process.

The original six tests remain. Full suite results:

- Python 3.13.15: **39 passed**, no warnings (8.02 seconds in the final run).
- Python 3.12.14: **39 passed**, no warnings (19.14 seconds in the final run).

Both used `python -B -m pytest tests -p no:cacheprovider`. No claim of biological validation follows from these computational invariants.

## 12. Frontend and API verification

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `VERCEL=1 npm run build`: passed; homepage and research-vision page prerendered.
- Headless Edge: actual network responses render two raster traces (1,617 E and 420 I events at defaults) and two rate traces (100 bins each). Original LIF plots still render.
- Desktop grid verified at 1440 px; mobile checked at 390 px without horizontal overflow. Silent results, stale-parameter messaging, excessive-work prevention, and busy-service error handling passed. No browser JavaScript errors.
- Local production-browser checks mirrored Vercel's API routing to a real backend using browser request routing; this was not a hosted Vercel test.
- Real HTTP smoke tests: health, LIF, synthetic demo, and network all returned 200; live DANDI returned 200 with five metadata records. Repeated network requests matched except execution time.
- Final build has no local backend API rewrite and no hardcoded localhost backend URL in browser bundles. Existing Vercel routing is unchanged.

## 13. Python compatibility

`backend/.python-version` is unchanged at **3.12**. The complete test suite passes on an isolated Python 3.12.14 environment and the existing Python 3.13.15 environment. The documented policy is >=3.12,<3.14. Brian2 wheels installed successfully for both. These runs verify Windows compatibility; hosted Linux deployment remains a separate check. Cross-version bitwise numerical equivalence is not promised.

## 14. Existing warning

Resolved without upgrading unrelated dependencies. The original Starlette warning concerned its TestClient httpx compatibility layer. Existing API assertions now use `httpx.AsyncClient` with `ASGITransport` and `asyncio.run`; no warning filters suppress it.

## 15. Scientific limitations

This educational network is neither patient-specific nor anatomically complete. Voltage-jump synapses omit conductances and receptor kinetics. The model omits morphology, ion channels, adaptation, plasticity, and measured external input. E/I balance depends on activity and weights as well as counts. Rates include initialization transients. CV is a limited variability proxy. All outputs are labeled simulated; spikes are not EEG and synchronized firing is not a seizure. No clinical classification or intervention was added.

## 16. Deployment concerns and Phase 3 readiness

No deployment was performed. Before production promotion, verify Vercel preview cold starts, Linux scientific wheels, bundle size, function memory and duration, and concurrent-request behavior. Brian2/SymPy/Cython increase the backend footprint; first import briefly blocks the event loop. Existing routing and Python baseline are preserved.

**Ready to begin Phase 3 development:** yes, as a tested computational foundation with documented assumptions. **Ready to claim clinical or biological validity:** no. Epilepsy Dynamics is marked Next Development Stage / Planned and has not been implemented. Hosted deployment readiness still requires the preview checks above.
