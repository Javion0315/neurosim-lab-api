"""The fixture follows the two DANDI REST response shapes; it is not a dataset."""
import asyncio

import httpx

from backend.app import providers


def test_dandi_search_reads_version_metadata(monkeypatch) -> None:
    paths: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        paths.append(request.url.path)
        if request.url.path == "/api/dandisets/":
            return httpx.Response(200, json={
                "results": [{
                    "identifier": "000001",
                    "most_recent_published_version": {"version": "0.1.0"},
                    "draft_version": None,
                }]
            })
        return httpx.Response(200, json={
            "name": "Fixture title",
            "contributor": [{"name": "Fixture author"}],
            "assetsSummary": {
                "species": [{"name": "Fixture species"}],
                "approach": [{"name": "Fixture approach"}],
            },
            "license": ["spdx:CC-BY-4.0"],
            "doi": "10.example/fixture",
        })

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(providers.httpx, "AsyncClient", lambda **_: client)
    result = asyncio.run(providers.DandiProvider().search_metadata("test"))
    assert len(result) == 1
    assert result[0].title == "Fixture title"
    assert result[0].authors == ["Fixture author"]
    assert result[0].species == ["Fixture species"]
    assert result[0].experimental_approach == ["Fixture approach"]
    assert result[0].kind == "real_dataset_metadata"
    assert paths == ["/api/dandisets/", "/api/dandisets/000001/versions/0.1.0/"]