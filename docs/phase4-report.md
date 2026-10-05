# Phase 4 implementation report: Real EEG

## 1. Files changed
- Backend: backend/app/eeg.py, backend/app/main.py.
- Data: backend/app/eeg_data/{chb01_03_2960_3080.npz, chb01_03.json, chb01-summary.txt, SOURCE-SHA256.txt, NOTICE.md}.
- Preparation: scripts/prepare_eeg.py, backend/requirements-eeg-preprocessing.txt.
- Frontend components: EEGLab.tsx, EEGPlot.tsx, eeg-client.ts, LabWorkspace.tsx, ResearchRoadmap.tsx, DynamicsLab.tsx; app/page.tsx and app/research-vision/page.tsx.
- Tests: tests/test_eeg.py, tests/browser_phase4.cjs; one Phase 3.1 browser assertion now expects the disabled Level 5 card.
- Documentation: this report and README.md.

## 2. Architecture
A server-owned recording registry maps allowed IDs to packaged artifacts. The EEG service validates and caches lossless samples, calibrates voltage, extracts bounded windows, and computes features/PSD. Small route handlers delegate to the service. The frontend uses a parent-owned useLabSession like the existing labs. Only the selected workspace mounts; #real-eeg, history, drafts, results, and in-flight work are preserved. One analysis request returns samples, statistics, spectra and provenance. Original science modules and simulation APIs are unchanged.

## 3. Exact source
CHB-MIT Scalp EEG Database, PhysioNet, version 1.0.0, DOI 10.13026/C2K01R; case chb01, recording chb01_03.edf.
- [Dataset](https://physionet.org/content/chbmit/1.0.0/)
- [Source EDF](https://physionet.org/files/chbmit/1.0.0/chb01/chb01_03.edf)
- [Official annotation](https://physionet.org/files/chbmit/1.0.0/chb01/chb01-summary.txt)
- [Official checksums](https://physionet.org/files/chbmit/1.0.0/SHA256SUMS.txt)

This is scalp EEG from a pediatric intractable-seizure dataset. No additional patient characteristics are inferred. Surrogate dates are not interpreted.

## 4. Acquisition and reproduction
The offline script downloaded this one 42,399,744-byte EDF, checksum list, and case summary over HTTPS. It checked the EDF against the official SHA-256, confirmed the summary annotation, read EDF metadata, and verified calibration against pyEDFlib's physical-signal reader. The full EDF was removed with its temporary directory after extraction.

Source SHA-256: 4c4a95a9b4331aeaadadd538763eb2e735950d9aa615b85ee6246c784be8ae90.

From the repository root in Python 3.12:
    python -m pip install -r backend/requirements-eeg-preprocessing.txt
    python scripts/prepare_eeg.py

Internet is needed only for offline preparation. JSON records time, reader/NumPy versions and script checksum. Regeneration can change preparation metadata or compressed bytes across versions; the digital sample SHA-256 is the stable content check:
ed1b04a5d7563e46bea84a8132c962c1e9a050fb94e08c895b23cdb8d2b26a02.

## 5. Derived subset
Yes: 331,547-byte compressed NPZ with an 8 x 30,720 int16 digital array, plus JSON calibration/provenance. It is a documented derivative, not synthetic data.
Artifact SHA-256: 08181e40f561a5422762f15eedbc6c4f604fb8a23162d6a23c60e96712177d1d.
Attribution and the Open Data Commons Attribution License v1.0 link accompany it.

## 6. Stored/served interval
Stored: [2960,3080) seconds from the 3,600-second recording's start. Windows are start-inclusive/end-exclusive, 2-30 seconds, on the native sample grid. Initial window: [2986,3006).
Presets (all 20 seconds):
- Before annotated seizure: [2976,2996)
- Around annotated seizure onset: [2986,3006)
- During annotated seizure: [3006,3026)
- Around annotated seizure end: [3026,3046)
- After annotated seizure: [3036,3056)

No preictal label is assigned.

## 7. Channels
FP1-F7, F7-T7, T7-P7, P7-O1, FP2-F8, F8-T8, T8-P8, P8-O2.
Zero-based EDF indices: 0,1,2,3,12,13,14,15. The repeated source label T8-P8 uses the first occurrence, index 14. Default: FP1-F7 and FP2-F8; display maximum: four. These are electrode derivations, not neurons.

## 8. Sampling
256 samples/second, unchanged; 3.90625 ms/sample. A 20-second window has 5,120 samples/channel. No visual or scientific downsampling.

## 9. Amplitude
EDF physical dimension: uV (microvolts). Selected channels have physical bounds -800 to 800 uV, digital bounds -2048 to 2047.
uV = (digital - digital_min) * (physical_max - physical_min) / (digital_max - digital_min) + physical_min.
Plots preserve physical amplitude, with shared symmetric ranges across channels and comparison windows.

## 10. Processing
Channel/time extraction, lossless storage, EDF calibration only. No added bandpass, notch, resampling, baseline removal or normalization. Source prefilter fields are blank and shown as unspecified. Segment-mean removal occurs only inside Welch PSD, not waveforms or features.

## 11. Annotation
Official 2996-3036 s boundaries remain exact. Neutral shading covers the annotation's intersection with each window, labeled Dataset annotation. Text retains the full interval even outside the shaded region. No detector or prediction is implied.

## 12. Features
For N calibrated samples x:
- Mean = sum(x)/N, uV: average offset; reference-sensitive.
- Population variance = sum((x-mean)^2)/N, uV^2, ddof=0: spread; artifact-sensitive.
- RMS = sqrt(sum(x^2)/N), uV: magnitude including DC offset.
- Line length = sum(i=2..N) abs(x[i]-x[i-1]), uV: combined amplitude variation and temporal complexity; sampling-, duration-, and noise-dependent.
- Peak-to-peak = max(x)-min(x), uV: range; one artifact can dominate.

Features use the complete native-rate window. Comparisons require equal durations and identical channels. None is a seizure score, health ranking or validated biomarker.

## 13. Spectral analysis
Welch one-sided PSD, uV^2/Hz, with existing NumPy: 256 Hz sampling; 512-sample (2 s) periodic Hann segments; 256-sample (50%) overlap; segment-mean subtraction; 512-point real FFT without zero padding; normalization fs*sum(window^2); interior one-sided bins doubled; arithmetic averaging of complete segments, incomplete trailing segments excluded. Bin spacing 0.5 Hz, range 0-128 Hz. A 20-second window gives 19 segments.

Analytical sinusoid/DC tests check frequency and integrated density. Bin spacing is not effective spectral resolution. Window averaging hides event timing. Longer segments improve frequency discrimination at the cost of temporal localization and fewer averages. No band powers or epilepsy-specific band claims.

## 14. API
- GET /api/eeg/recordings
- GET /api/eeg/recordings/{recording_id}/metadata
- POST /api/eeg/recordings/{recording_id}/analyze

Example JSON:
{"channels":["FP1-F7","FP2-F8"],"windows":[{"start_s":2976,"end_s":2996},{"start_s":3006,"end_s":3026}]}

Response includes kind=real_eeg, provenance, time/voltage arrays, features, PSD and method parameters. Unknown IDs: 404. Invalid channels, extra fields, non-finite/off-grid/out-of-bounds times or unequal comparison durations: 422. Missing/corrupt data: explicit 503. No user filesystem paths or synthetic fallback.

## 15. Dependencies
No new runtime dependency. NumPy already exists. pyedflib==0.1.42 is offline-only, in separate preprocessing requirements. Preparation used its Python 3.12 Windows wheel. Python 3.13 source installation failed on this machine's locale, so reproduction explicitly uses Python 3.12.

## 16. Performance
No runtime EDF acquisition. The packaged artifact is checked and cached read-only per worker. Maximum: two windows x four channels x 30 s x 256 Hz = 61,440 voltage samples, plus bounded time/PSD arrays. Sync FastAPI routes run in its thread pool. The frontend prevents overlapping submissions and has a 20-second timeout. Plotly mounts only in the active workspace; ResizeObserver follows container changes.

## 17. Added tests
20 backend cases cover source checksums/metadata, annotation, dimensions/timestamps, finite deterministic features, calibration, input bounds, IDs/fields, comparison, analytical PSD and explicit missing/corrupt-data failure.
The production-browser suite uses real EEG responses and checks deep-link isolation, one request, native samples, axes/shading, channel cap, empty drafts, comparison, features/PSD, persistent state/history, mobile sizing and failure/retry. Only the old disabled Level 4 assertion changed to Level 5.

## 18-21. Verification
- Full pytest: 87 passed on both Python 3.13 and Python 3.12, one upstream Starlette TestClient/httpx deprecation warning.
- Lint: passed.
- Typecheck: passed.
- Vercel-mode production build: passed.
- Numeric-input tests: 3 passed.
- Existing Phase 3 and Phase 3.1 browser suites: passed.
- New Phase 4 browser suite: passed on the final build, including canvas/container sizing after mobile resize. Desktop waveform/annotation/features/PSD and mobile screenshots were visually inspected. The common time axis is anchored below the complete stack.

## 22. Deployment
Vercel Services routing is unchanged: same-origin /api/* reaches FastAPI. Commit artifacts/notices under the backend service root. Do not deploy the full EDF or preprocessing dependencies. Runtime needs read access only, no acquisition network or persistent writable disk. Restart workers when replacing artifacts. No Vercel preview deployment was performed; verify artifact inclusion and the metadata endpoint after deployment. Python 3.12 remains the production baseline.

## 23. Scientific limits
One case/recording cannot establish a generalizable biomarker or predictive validity. Scalp EEG reflects aggregate voltage with noise and biological complexity; individual neuronal spikes generally cannot be directly identified. There is no neuron/channel mapping, diagnosis, forecasting, classifier, treatment advice, risk score, alarm or clinical performance metric. Seizure labels are dataset annotations.

## 24. UX limits
One curated recording, eight available derivations; the registry is the extension point. Bounded channels/windows; presets set drafts and Load EEG applies them. Previous results retain explicit labels. Vertically stacked comparisons share scales, so smaller signals may appear flat. Feature tables scroll horizontally on mobile. Minimal plot interaction; no EDF upload, full-recording timeline, spectrogram or preprocessing controls.

## 25. Phase 5 foundation
Ready as software infrastructure: provenance, native-rate windows, explicit annotations, reusable feature/spectral functions, bounded APIs and persistent sessions. Not sufficient evidence for forecasting: operational labels, larger cohorts, leakage-safe/subject-aware splits and independent validation remain future work. Level 5 is NEXT and is not implemented.

### Final verification details
- Python 3.13: 87 passed in 19.27 s; Python 3.12: 87 passed in 16.84 s.
- The first Python 3.12 run overlapped a production build and exceeded the existing simulation runtime deadline (80 passed, 7 fixture errors). A standalone rerun passed without changing simulation limits or equations.
- Final lint, typecheck and production build passed after the responsive plot fix.
- Existing Phase 3/3.1 browser suites and all three numeric-input tests passed.
- Live DANDI returned HTTP 200 with five records, also verified through the actual browser search UI.
- Largest permitted EEG request: HTTP 200, 1,414,971 response bytes, approximately 534 ms including a cold in-process read on this machine; this is a local observation, not a hosted latency guarantee.
- Production route manifest: no Next.js API proxy rewrites. EEG fetches use same-origin relative paths. A bundled library contains the literal localhost in a generic URL parser, not an API endpoint.
- No external deployment was made.
