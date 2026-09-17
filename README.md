# NeuroSim Lab

An interactive computational neuroscience playground. Phase 1 includes a leaky integrate-and-fire (LIF) simulator, a labeled synthetic spike demo, and live DANDI metadata search. No biological recording is bundled or implied by the demo.

## Scientific motivation

The project pairs reproducible computational experiments with a path toward analysis of public neurophysiology. It is a self-study and research portfolio, not biological validation of a model.

## Architecture

| Directory | Purpose |
| --- | --- |
| `frontend/` | Next.js, TypeScript, Tailwind CSS, Plotly views |
| `backend/` | FastAPI, NumPy LIF simulation, spike statistics, DANDI provider |
| `tests/` | Python scientific and API tests |
| `docs/` | Methods, data access, reproducibility |
| `data/` | Placeholder; no recordings committed |
| `notebooks/` | Future analyses |

The frontend calls the backend over HTTP. The backend keeps real metadata, derived statistics, and simulated samples in separate response types. The DANDI provider implements `NeuralDataProvider` for future sources.

## Installation and running

Requires Python 3.11+ and Node.js 20+.

Backend, from repository root:

```bash
python -m venv .venv
# Activate .venv for your shell, then:
pip install -r backend/requirements-dev.txt
uvicorn backend.app.main:app --reload --port 8000
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
cd frontend
npm run lint
npm run typecheck
npm run build
```

## Data sources

Live public metadata comes from the [DANDI Archive REST API](https://docs.dandiarchive.org/api/rest-api/). Search queries the Dandiset list and up to five version metadata records; it never fetches assets. Search results link to their original Dandiset page. Phase 1 does not retrieve NWB assets, recording traces, or real spike timestamps. The synthetic demo uses a fixed seed and is always labeled synthetic. See [data sources](docs/data-sources.md).

## Mathematical models

LIF integrates `tau_m dV/dt = -(V - V_rest) + R I` by forward Euler at 0.1 ms. `R I` is exposed as voltage drive in mV. A threshold crossing records a spike, resets voltage, and starts an absolute refractory period. The demo generates independent Poisson spike trains. See [methodology](docs/methodology.md).

## Reproducibility

LIF requests and responses carry parameters, seed, duration, model name, and software version. The demo uses a fixed seed. See [reproducibility](docs/reproducibility.md).

## Limitations

LIF neurons are simplified. Synthetic Poisson trains are not observations. DANDI metadata alone does not reveal whether an asset contains usable spike timestamps; that requires NWB inspection in a later phase. Network, STDP, comparison, and export modules are planned for later phases.

## Future work

Phase 2: Brian2 network and pair-based STDP. Phase 3: a small public NWB example, comparison of selected statistics, and experiment export. Phase 4: accessibility and polish.

## Deployment

This repository uses **two Vercel projects from one GitHub repository**. Vercel's single-project multi-service feature is currently beta. The public frontend serves `/` and accepts `/api/*` on its own origin; a Next.js rewrite forwards those requests to the separately deployed FastAPI project. The browser never needs the backend hostname. See Vercel's [monorepo guide](https://vercel.com/docs/monorepos), [Python runtime guide](https://vercel.com/docs/functions/runtimes/python), and [FastAPI guide](https://vercel.com/docs/frameworks/backend/fastapi).

### 1. Push to GitHub

Create an empty GitHub repository named `neurosim-lab`. Install Git if `git --version` fails, then from this repository root:

```bash
git init
git add .
git commit -m "Prepare NeuroSim Lab for Vercel"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/neurosim-lab.git
git push -u origin main
```

If the repository is already initialized or has a remote, keep the existing history and push the deployment changes normally. Never commit `.env.local`, `.venv`, `node_modules`, or datasets.

### 2. Import the backend project first

In the Vercel dashboard, choose **Add New → Project**, import the GitHub repository, set **Root Directory** to `backend`, and select the **FastAPI** framework preset. Leave build command and output directory at their defaults; do not use `uvicorn` as a production start command. Vercel detects the canonical `app` in `backend/app/main.py` and reads `backend/requirements.txt`. The `backend/.python-version` file selects Python 3.12, which Vercel supports. No environment variables are required for Phase 1. Deploy and record the public HTTPS backend origin, for example `https://YOUR-BACKEND.vercel.app`. Ensure deployment protection does not block public testing.

Verify directly:

- `https://YOUR-BACKEND.vercel.app/api/health` returns JSON with `status: ok`.
- `https://YOUR-BACKEND.vercel.app/api/demo` returns `kind: synthetic_demo`.
- `https://YOUR-BACKEND.vercel.app/api/dandi/search?q=electrophysiology` returns public metadata or a clear 503 if DANDI is unavailable.
- POST `https://YOUR-BACKEND.vercel.app/api/lif` with JSON `{}` returns `kind: simulation`.

### 3. Import the frontend project

Import the **same** GitHub repository again as a second Vercel project. Set **Root Directory** to `frontend`, choose **Next.js**, and leave install, build, and output settings at their defaults. Add one **server-side** environment variable for Production (and Preview if desired):

```text
API_UPSTREAM_URL=https://YOUR-BACKEND.vercel.app
```

Use only the origin: no `/api` suffix or trailing path. Redeploy the frontend after setting or changing this variable. The build deliberately fails on Vercel if it is absent or uses HTTP. Do not set `NEXT_PUBLIC_API_URL`; the browser calls relative `/api/*` URLs. The rewrite forwards them to the backend's matching `/api/*` paths. Because browser requests stay on the frontend origin, production CORS permissions are unnecessary. FastAPI's existing CORS allowlist remains limited to local development origins.

### 4. Verify the public site

On the frontend deployment, open:

- `https://YOUR-FRONTEND.vercel.app/` — homepage.
- `https://YOUR-FRONTEND.vercel.app/api/health` — same backend health JSON through the rewrite.
- `https://YOUR-FRONTEND.vercel.app/api/demo` — labeled synthetic data.
- `https://YOUR-FRONTEND.vercel.app/api/dandi/search?q=electrophysiology` — DANDI metadata search.

Run a LIF request through the frontend domain:

```powershell
Invoke-RestMethod -Method Post -Uri 'https://YOUR-FRONTEND.vercel.app/api/lif' -ContentType 'application/json' -Body '{}'
```

Check the browser's Network tab: application API requests should target the frontend domain at `/api/...`, never `localhost`.

### Local development and troubleshooting

For local development, start Uvicorn on port 8000 and Next.js on port 3000. `frontend/.env.example` shows the optional `API_UPSTREAM_URL=http://localhost:8000`; without it, the rewrite uses that local default outside Vercel. Install local Python tools with `pip install -r backend/requirements-dev.txt`. Local Python 3.11+ works; Vercel uses 3.12.

If the frontend deployment fails during configuration, set `API_UPSTREAM_URL` to the backend's **public HTTPS origin**. A 404 under `/api/*` usually means the backend project was imported with the wrong Root Directory or is not deployed. A 401/403 from the upstream may mean Vercel deployment protection is enabled. A 502/503 can indicate backend startup, function timeout, or a temporary DANDI error; inspect the backend deployment's Function Logs. The backend has no persistent filesystem, background worker, or global experiment state. Each LIF simulation runs in one request. The Python function must fit Vercel's bundle and duration limits; Phase 1 keeps only FastAPI, NumPy, and HTTPX as runtime dependencies. Preview frontend deployments point at whichever backend origin is configured for Preview; they do not automatically pair with a matching backend preview deployment.
## References

- [DANDI Archive](https://dandiarchive.org/)
- [DANDI REST API documentation](https://docs.dandiarchive.org/api/rest-api/)
- [Neurodata Without Borders](https://www.nwb.org/)
