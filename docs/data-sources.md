# Data sources

Phase 1 queries the public [DANDI REST API](https://docs.dandiarchive.org/api/rest-api/) for Dandiset list and version metadata (at most five results per search). The source link on each result points to the original Dandiset page. Missing authors, species, approach, DOI, or license are shown as unavailable rather than inferred. Metadata search never downloads NWB assets.

No real recording or derived real-data spike statistic is served in Phase 1. The raster on the Real Data page is explicitly synthetic. Future work should identify a public electrophysiology Dandiset, inspect its asset metadata and license, and extract a documented small sample with provenance and checksums. NWB availability does not guarantee spike timestamps are present.
