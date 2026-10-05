"""Phase 1 API. Public metadata queries never fetch recording assets."""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from time import perf_counter
import httpx

from .network import NetworkBusyError, NetworkParameters, NetworkResult, NetworkRuntimeError, initialize_network_engine, simulate_network
from .dynamics import ComparisonResult, ExperimentParameters, compare_network
from .providers import DandiProvider, DatasetMetadata
from .science import DemoResult, LIFParameters, LIFResult, VERSION, simulate_lif, synthetic_demo


app = FastAPI(title="NeuroSim Lab API", version=VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
provider = DandiProvider()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "NeuroSim Lab API", "version": VERSION}


@app.post("/api/lif", response_model=LIFResult)
def lif(parameters: LIFParameters) -> LIFResult:
    return simulate_lif(parameters)


@app.get("/api/demo", response_model=DemoResult)
def demo() -> DemoResult:
    return synthetic_demo()


@app.get("/api/dandi/search", response_model=list[DatasetMetadata])
async def dandi_search(q: str = Query(min_length=2, max_length=80)) -> list[DatasetMetadata]:
    try:
        return await provider.search_metadata(q)
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=503, detail="DANDI metadata is temporarily unavailable") from exc


@app.post("/api/network", response_model=NetworkResult)
async def network(parameters: NetworkParameters) -> NetworkResult:
    started = perf_counter()
    initialize_network_engine()
    try:
        return await run_in_threadpool(simulate_network, parameters, started)
    except (NetworkBusyError, NetworkRuntimeError) as exc:
        raise HTTPException(status_code=503, detail=str(exc), headers={"Retry-After": "2"}) from exc


@app.post("/api/network/compare", response_model=ComparisonResult)
async def network_comparison(parameters: ExperimentParameters) -> ComparisonResult:
    started = perf_counter()
    initialize_network_engine()
    try:
        return await run_in_threadpool(compare_network, parameters, started)
    except (NetworkBusyError, NetworkRuntimeError) as exc:
        raise HTTPException(status_code=503, detail=str(exc), headers={"Retry-After": "2"}) from exc
