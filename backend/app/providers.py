"""Provider boundary for public neural dataset metadata."""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Any

import httpx
from pydantic import BaseModel


class DatasetMetadata(BaseModel):
    kind: str = "real_dataset_metadata"
    provider: str = "DANDI"
    dandiset_id: str
    title: str
    authors: list[str]
    species: list[str]
    experimental_approach: list[str]
    source_url: str
    doi: str | None
    license: list[str]
    recording_information: str | None = None


class NeuralDataProvider(ABC):
    @abstractmethod
    async def search_metadata(self, query: str, limit: int = 5) -> list[DatasetMetadata]:
        """Return public metadata without downloading recording assets."""


def names(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if isinstance(item, str):
            out.append(item)
        elif isinstance(item, dict):
            name = item.get("name")
            if isinstance(name, str):
                out.append(name)
    return out


def map_dandiset(dandiset_id: str, metadata: dict[str, Any]) -> DatasetMetadata:
    """Map DANDI version metadata; absent fields remain explicitly unavailable."""
    summary = metadata.get("assetsSummary") or {}
    if not isinstance(summary, dict):
        summary = {}
    doi = metadata.get("doi")
    return DatasetMetadata(
        dandiset_id=dandiset_id,
        title=str(metadata.get("name") or "Title unavailable"),
        authors=names(metadata.get("contributor")),
        species=names(summary.get("species")),
        experimental_approach=names(summary.get("approach")),
        source_url=f"https://dandiarchive.org/dandiset/{dandiset_id}",
        doi=str(doi) if isinstance(doi, str) and doi else None,
        license=names(metadata.get("license")),
        recording_information=None,
    )


class DandiProvider(NeuralDataProvider):
    base_url = "https://api.dandiarchive.org/api"

    async def search_metadata(self, query: str, limit: int = 5) -> list[DatasetMetadata]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{self.base_url}/dandisets/",
                params={"search": query, "page_size": min(limit, 5)},
            )
            response.raise_for_status()
            body = response.json()
            items = body.get("results", []) if isinstance(body, dict) else []

            async def fetch_version(item: dict[str, Any]) -> DatasetMetadata | None:
                dandiset_id = str(item.get("identifier") or "")
                version_info = item.get("most_recent_published_version") or item.get("draft_version") or {}
                version = version_info.get("version") if isinstance(version_info, dict) else None
                if not dandiset_id or not version:
                    return None
                try:
                    detail = await client.get(f"{self.base_url}/dandisets/{dandiset_id}/versions/{version}/")
                    detail.raise_for_status()
                    metadata = detail.json()
                    if not isinstance(metadata, dict):
                        return None
                    return map_dandiset(dandiset_id, metadata)
                except (httpx.HTTPError, ValueError):
                    # Skip one unavailable version; never invent its metadata.
                    return None

            results = await asyncio.gather(*(fetch_version(i) for i in items if isinstance(i, dict)))
            if items and not any(results):
                raise httpx.HTTPError("DANDI version metadata is unavailable")
            return [result for result in results if result is not None]