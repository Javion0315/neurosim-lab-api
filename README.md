# NeuroSim Lab

An interactive computational neuroscience playground. Phase 3.1 refines numeric editing and adds a selectable laboratory workspace. Phase 3 provides matched network-state experiments and automatic default network loading alongside the existing Single Neuron Lab, labeled synthetic spike demo, and live DANDI metadata search. No biological recording is bundled or implied by the demo.

The platform now also documents a nine-level learning and research roadmap. The `/research-vision` page separates measurable science, research hypotheses, and long-term concepts involving epilepsy research, wearable signals, computational forecasting, and olfactory neuromodulation. It makes no clinical efficacy claim.

## Scientific motivation

The project pairs reproducible computational experiments with a path toward analysis of public neurophysiology. It is a self-study and research portfolio, not biological validation of a model.

## Architecture

| Directory | Purpose |
| --- | --- |
| `frontend/` | Next.js, TypeScript, Tailwind CSS, Plotly views |
| `backend/` | FastAPI, NumPy single-neuron LIF, Brian2 E/I network, spike statistics, DANDI provider |
| `tests/` | Python scientific and API tests |
| `docs/` | Methods, data access, reproducibility |
| `data/` | Placeholder; no recordings committed |
| `notebooks/` | Future analyses |

The frontend calls the backend over HTTP. The backend keeps real metadata, derived statistics, and simulated samples in separate response types. The DANDI provider implements `NeuralDataProvider` for future sources.

## Installation and running

Use Python 3.12 (production baseline) or Python 3.13 (local compatibility), and Node.js 20+. The supported Python policy is >=3.12,<3.14; `backend/.python-version` remains 3.12.

Backend, from repository root:

```bash
python -m venv .venv
# Activate .venv for your shell, then:
pip install -r backend/requirements-dev.txt
python -m uvicorn backend.app.main:app --reload --port 8000
```

Frontend, in a second terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env.local`. Open `http://localhost:3000`.

## Checks

```bash
python -m pytest tests
node --test tests/test_numeric_input.cjs
cd frontend
npm run lint
npm run typecheck
npm run build
```

## Explore NeuroSim Lab (Phase 3.1)

Use the large **Explore NeuroSim Lab** cards to select one active laboratory.
Single Neuron is the default. The cards show level, name, and implementation
status; Real EEG is implemented and Seizure Forecasting is marked NEXT. The separate
Learning + Research Roadmap still describes future work.

Stable links: #single-neuron (with #neuron-lab retained as an alias),
#network-lab, #epilepsy-dynamics, and #real-eeg. Direct links activate the correct lab
before any simulation starts. Back/Forward restores lab selection. On mobile,
the cards scroll horizontally with a visible next-card edge and scroll hint.

Draft inputs, completed results, and pending requests survive switching labs on
the same page. Inactive lab components and plots are unmounted, not hidden.
The initial network baseline runs only when a network-based lab is first needed.
The public archive's synthetic demo loads when its section approaches the viewport.

All 20 numeric fields allow empty editing states without forcing zero. Run or
Enter validates required values, finite numbers, ranges, integer constraints,
voltage relationships, and work limits before calling the API. Invalid fields
receive an inline message and focus. Nothing is silently restored on blur.

Phase 3 initially shows one Reference Network result set and one participation
trace. Changing a parameter immediately opens the comparison layout; experimental
outputs appear only when a completed result matches those parameters. Positive
differences have an explicit + sign without clinical or value judgments.

See the [Phase 3.1 report](docs/phase31-report.md) for the architecture, field
audit, verification, files changed, and remaining UX limitations.

## Neural Network Lab (Level 2)

Select Neural Network in Explore NeuroSim Lab. The exact 100-neuron (80 E / 20 I) default loads automatically; then vary connectivity, composition, synaptic weights, drive, duration, or seed. Outputs are explicitly **SIMULATED**: E/I spike raster, population firing rates, summary metrics, and a documented population-rate CV proxy. High synchronization is not automatically pathological.

The endpoint is `POST /api/network`; `{}` uses defaults. Default duration is 500 ms, connection probability 0.1, excitatory weight 0.5 mV, inhibitory magnitude 2 mV, external drive 22 mV, and seed 42. The simulator is Brian2 2.10.1 with a NumPy runtime and fixed 0.2 ms step. See [API schema and limits](docs/network-api.md), [methodology](docs/methodology.md), [reproducibility](docs/reproducibility.md), and the [Phase 2 verification report](docs/phase2-report.md).

Levels 1-4 are implemented. Level 5, **Seizure Forecasting**, is the next development stage. No seizure classification, forecasting or intervention is included.

## Epilepsy Dynamics (Level 3)

Compare the **Reference Network** with a controlled experimental condition using
the unchanged Phase 2 LIF simulator. Four controls vary excitatory strength,
inhibitory strength, connectivity, and external drive. Presets display exact
one-parameter changes. Matched rasters and E/I rates, a metric comparison table,
and 5 ms distinct-neuron participation show measured effects without assuming
a particular outcome. Population-rate CV is retained.

The new POST /api/network/compare endpoint accepts those four optional fields;
{} runs the exact reference once. The two network labs share this initial request on first use. Manual
Phase 2 runs keep the existing API. Comparison size, composition, duration, and
seed are fixed to the original defaults, with matched noise and initial voltages.

This is **SIMULATED NETWORK DYNAMICS**. High firing or synchronization does not
establish a biological seizure. No intrinsic bursting model, burst classifier,
seizure score, or clinical prediction is introduced. See the
[Phase 3 report](docs/phase3-report.md) for files, benchmarks, verification, and
limitations, and [methodology](docs/methodology.md) for exact metric definitions.

## Data sources

Live public metadata comes from the [DANDI Archive REST API](https://docs.dandiarchive.org/api/rest-api/). Search queries the Dandiset list and up to five version metadata records; it never fetches assets. Search results link to their original Dandiset page. Phase 1 does not retrieve NWB assets, recording traces, or real spike timestamps. The synthetic demo uses a fixed seed and is always labeled synthetic. See [data sources](docs/data-sources.md).

## Mathematical models

LIF integrates `tau_m dV/dt = -(V - V_rest) + R I` by forward Euler at 0.1 ms. `R I` is exposed as voltage drive in mV. A threshold crossing records a spike, resets voltage, and starts an absolute refractory period. The demo generates independent Poisson spike trains. See [methodology](docs/methodology.md).

## Reproducibility

LIF requests and responses carry parameters, seed, duration, model name, and software version. The demo uses a fixed seed. See [reproducibility](docs/reproducibility.md).

## Limitations

LIF neurons are simplified. Synthetic Poisson trains are not observations. DANDI metadata alone does not reveal whether an asset contains usable spike timestamps; that requires NWB inspection in a later phase. The implemented network is an educational E/I model, not a biological recording or complete cortical circuit. STDP, recording-level comparison, and exports remain future work.

## Future work

Phase 3 implements controlled comparisons of the Phase 2 Brian2 E/I network. Phase 4, Real EEG, adds annotated real scalp EEG exploration; it does not establish model-data equivalence. Plasticity, forecasting, interventions, and exports remain future work; none are implemented automatically.

## Deployment

This repository uses one [Vercel Services](https://vercel.com/docs/services) project. Import the repository with its **Root Directory set to the repository root**, and choose **Services** as the Vercel project framework. The root `vercel.json` defines two services and public routing:

| Service | Root | Framework | Public route |
| --- | --- | --- | --- |
| `frontend` | `frontend/` | Next.js | `/(.*)` after API routes |
| `backend` | `backend/` | FastAPI | `/api/(.*)` |

The first matching top-level rewrite wins. Vercel passes the original URL path to FastAPI, so `/api/health` reaches the existing `/api/health` handler directly. There is no `/api/backend` prefix. See [Vercel Services routing](https://vercel.com/docs/services/routing). The backend service uses the canonical `app.main:app` from `backend/app/main.py`; `backend/.python-version` selects Python 3.12.

### Deploy

1. Commit and push `vercel.json` and the other repository files to GitHub. If Git is not set up yet, create an empty GitHub repository and run these commands from the repository root:

   ```bash
   git init
   git add .
   git commit -m "Configure Vercel Services"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/neurosim-lab.git
   git push -u origin main
   ```

   If this repository already has a remote, commit and push normally rather than running `git init` or adding another remote.

2. In the Vercel Dashboard, import the repository as **one project**. Select **Services** as Framework Preset and leave Root Directory at `./` (repository root). Do not set a root-level build command or output directory; each service builds from its own root.
3. The detected services should be `frontend` (Next.js, root `frontend/`) and `backend` (FastAPI, root `backend/`). The public routing should show the backend for `/api/(.*)` and frontend for `/(.*)`. No `API_UPSTREAM_URL` or `NEXT_PUBLIC_API_URL` is required on Vercel. Remove any old production `API_UPSTREAM_URL` value from the earlier two-project setup.
4. Deploy, then use the **single deployment domain** for all checks below.

### Verify

- `https://<deployment-domain>/` loads the homepage.
- `https://<deployment-domain>/api/health` returns JSON with `status: ok` and `service: NeuroSim Lab API`.
- `https://<deployment-domain>/api/demo` returns `kind: synthetic_demo`.
- `https://<deployment-domain>/api/dandi/search?q=electrophysiology` returns public DANDI metadata, or a clear 503 if DANDI is temporarily unavailable.
- POST `https://<deployment-domain>/api/network` with JSON `{}` returns `kind: simulation`, spike events, population rates, and network metadata. Validate cold-start timing and dependency bundle size in a preview deployment.
- POST `https://<deployment-domain>/api/lif` with JSON `{}` returns `kind: simulation`:

  ```powershell
  Invoke-RestMethod -Method Post -Uri 'https://<deployment-domain>/api/lif' -ContentType 'application/json' -Body '{}'
  ```

Check the browser's Network tab: its API requests should use the same deployment domain at `/api/...`, never localhost or `/api/backend/api/...`.

### Local development

The plain local setup still uses two processes: Uvicorn on `localhost:8000` and Next.js on `localhost:3000`. Outside Vercel, `frontend/next.config.ts` rewrites relative `/api/*` calls to the local backend. `frontend/.env.example` shows the optional local-only `API_UPSTREAM_URL`; the default is `http://localhost:8000`. Vercel's Services routing owns API paths in production, so the Next.js rewrite is disabled there. You may also use `vercel dev -L` from the repository root to exercise both services with Vercel's local router, provided a compatible Python is installed.

If deployment still shows `/api/backend`, confirm Vercel is building the latest commit from the repository root with Framework Preset **Services**, and confirm that the root `vercel.json` is included. A backend 500 indicates a FastAPI startup or dependency error; inspect the backend service logs. DANDI is an external public API and may occasionally return a 503. No NWB assets are bundled or downloaded.
## References

- [DANDI Archive](https://dandiarchive.org/)
- [DANDI REST API documentation](https://docs.dandiarchive.org/api/rest-api/)
- [Neurodata Without Borders](https://www.nwb.org/)

## Phase 4: Real EEG

Open **Explore Labs > Real EEG** or /#real-eeg. The workspace serves a real,
checksum-verified CHB-MIT subset: case chb01, chb01_03.edf, [2960,3080) seconds,
eight bipolar derivations at 256 Hz in EDF-calibrated microvolts. The official
seizure interval is 2996-3036 seconds. Stacked waveforms, descriptive features,
Welch PSD and equal-duration window comparisons are implemented; forecasting is not.

The 331,547-byte NPZ, provenance manifest and attribution live under
backend/app/eeg_data/. No EDF download occurs at runtime; missing/corrupt data
fails explicitly without synthetic replacement. Existing labs and DANDI remain.

See [the complete Phase 4 report](docs/phase4-report.md) for exact sources,
channels, equations, API, reproduction, verification and deployment limits.
The offline EDF reader uses Python 3.12 and separate requirements in
backend/requirements-eeg-preprocessing.txt. The full recording is not bundled.

Run the complete backend suite with python -m pytest tests and numeric checks
with node tests/test_numeric_input.cjs. The new tests/browser_phase4.cjs uses the
same external Playwright/Edge setup as existing browser suites, a production
frontend on port 3030 and backend on port 8000. It forwards relative API requests
to the real backend to emulate Vercel routing.
