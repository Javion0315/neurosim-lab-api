"""Rebuild the small teaching artifact from the official checksum-verified EDF.

Run from repository root after installing backend/requirements-eeg-preprocessing.txt.
Only chb01_03.edf is downloaded, to a temporary directory removed on exit.
No clinical dates or patient demographic metadata are retained.
"""
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re
import tempfile
from urllib.request import urlopen

import numpy as np
import pyedflib

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "backend" / "app" / "eeg_data"
BASE = "https://physionet.org/files/chbmit/1.0.0/"
RECORD = "chb01/chb01_03.edf"
CHANNELS = ["FP1-F7", "F7-T7", "T7-P7", "P7-O1", "FP2-F8", "F8-T8", "T8-P8", "P8-O2"]
START, END, FS = 2960, 3080, 256


def fetch(url, limit):
    with urlopen(url, timeout=90) as response:
        content = response.read(limit + 1)
    if len(content) > limit:
        raise ValueError("Source exceeded download limit")
    return content


def main():
    checksums = fetch(BASE + "SHA256SUMS.txt", 200000).decode()
    checksum = next(line.split()[0] for line in checksums.splitlines() if line.split()[-1].lstrip("./") == RECORD)
    summary = fetch(BASE + "chb01/chb01-summary.txt", 100000)
    match = re.search(rb"File Name: chb01_03.edf.*?Seizure Start Time: (\d+) seconds.*?Seizure End Time: (\d+) seconds", summary, re.S)
    if not match or tuple(map(int, match.groups())) != (2996, 3036):
        raise ValueError("Unexpected source annotation; do not silently alter teaching example")
    source = fetch(BASE + RECORD, 60_000_000)
    if sha256(source).hexdigest() != checksum:
        raise ValueError("Official EDF checksum mismatch")
    channels, digital = [], []
    with tempfile.TemporaryDirectory(prefix="neurosim-eeg-") as directory:
        path = Path(directory) / "chb01_03.edf"
        path.write_bytes(source)
        with pyedflib.EdfReader(str(path)) as reader:
            labels = reader.getSignalLabels()
            for label in CHANNELS:
                index = labels.index(label)  # First T8-P8 derivation; source has a duplicate label.
                if reader.getSampleFrequency(index) != FS or reader.getPhysicalDimension(index).strip() != "uV":
                    raise ValueError("Unexpected EDF sampling or units")
                h = reader.getSignalHeader(index)
                samples = reader.readSignal(index, start=START * FS, n=(END - START) * FS, digital=True)
                converted = (samples.astype(float) - h["digital_min"]) * (h["physical_max"] - h["physical_min"]) / (h["digital_max"] - h["digital_min"]) + h["physical_min"]
                np.testing.assert_allclose(converted, reader.readSignal(index, start=START * FS, n=(END - START) * FS), atol=1e-10)
                digital.append(samples.astype("<i2"))
                channels.append({
                    "name": label, "source_index": index, "unit": h["dimension"].strip(),
                    "physical_min": h["physical_min"], "physical_max": h["physical_max"],
                    "digital_min": h["digital_min"], "digital_max": h["digital_max"],
                    "source_prefilter": h["prefilter"], "transducer": h["transducer"],
                })
            duration = reader.getFileDuration()
            source_channel_count = reader.signals_in_file
    OUT.mkdir(parents=True, exist_ok=True)
    artifact = OUT / "chb01_03_2960_3080.npz"
    samples = np.stack(digital)
    np.savez_compressed(artifact, digital=samples)
    metadata = {
        "kind": "real_eeg", "recording_id": "chb01_03", "dataset": "CHB-MIT Scalp EEG Database",
        "provider": "PhysioNet", "dataset_version": "1.0.0", "doi": "10.13026/C2K01R",
        "source_recording": "chb01_03.edf", "case": "chb01", "source_url": BASE + RECORD,
        "dataset_url": "https://physionet.org/content/chbmit/1.0.0/",
        "annotation_url": BASE + "chb01/chb01-summary.txt",
        "license": "Open Data Commons Attribution License v1.0",
        "license_url": "https://physionet.org/content/chbmit/view-license/1.0.0/",
        "citation": "Guttag, J. (2010). CHB-MIT Scalp EEG Database (version 1.0.0). PhysioNet. https://doi.org/10.13026/C2K01R",
        "source_sha256": checksum, "source_bytes": len(source),
        "source_checksum_url": BASE + "SHA256SUMS.txt",
        "annotation_sha256": sha256(summary).hexdigest(),
        "sampling_hz": FS, "unit": "uV", "source_duration_s": duration,
        "source_channel_count": source_channel_count, "channels": channels,
        "stored_start_s": START, "stored_end_s": END, "samples_per_channel": (END - START) * FS,
        "annotation": {"start_s": 2996, "end_s": 3036, "label": "Dataset annotation"},
        "artifact": artifact.name, "artifact_bytes": artifact.stat().st_size,
        "artifact_sha256": sha256(artifact.read_bytes()).hexdigest(),
        "digital_samples_sha256": sha256(samples.tobytes()).hexdigest(),
        "artifact_format": "NumPy NPZ; lossless int16 digital samples, channels x time",
        "preprocessing": "Interval/channel extraction only. No added filtering, notch, resampling, baseline removal or normalization. EDF affine calibration converts digital counts to uV on serving.",
        "calibration": "uV = (digital - digital_min) * (physical_max - physical_min) / (digital_max - digital_min) + physical_min",
        "reader": "pyedflib " + pyedflib.__version__, "numpy_version": np.__version__,
        "prepared_utc": datetime.now(timezone.utc).isoformat(),
        "preparation_script": "scripts/prepare_eeg.py",
        "preparation_script_sha256": sha256(Path(__file__).read_bytes()).hexdigest(),
        "dates": "Recording dates are surrogates; the module uses elapsed seconds only.",
    }
    (OUT / "chb01_03.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    (OUT / "chb01-summary.txt").write_bytes(summary)
    (OUT / "SOURCE-SHA256.txt").write_text(checksum + "  " + RECORD + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
