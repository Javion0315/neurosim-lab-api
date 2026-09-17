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
