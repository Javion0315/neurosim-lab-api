"use client";
import { useEffect, type FormEvent } from "react";
import EEGPlot from "./EEGPlot";
import { eegChannels, eegPresets, type EEGParameters, type EEGResult, type EEGChannel } from "./eeg-client";
import type { LabController } from "./useLabSession";

const metrics: { key: keyof EEGChannel["features"]; name: string; definition: string }[] = [
  { key: "mean_uv", name: "Mean (uV)", definition: "sum(x) / N: average voltage; sensitive to offset and reference, not a firing rate." },
  { key: "variance_uv2", name: "Variance (uV^2)", definition: "sum((x - mean)^2) / N (ddof=0): spread about the mean; affected by artifacts and window selection." },
  { key: "rms_uv", name: "RMS (uV)", definition: "sqrt(sum(x^2) / N): signal magnitude including DC offset; does not isolate a physiological source." },
  { key: "line_length_uv", name: "Line length (uV)", definition: "sum from i=2 to N of abs(x[i] - x[i-1]): combined amplitude variation and temporal complexity; depends on sampling rate, duration and noise. High values do not automatically mean seizure." },
  { key: "peak_to_peak_uv", name: "Peak-to-peak (uV)", definition: "max(x) - min(x): amplitude range; one artifact can dominate it." },
];
const inputClass = "mt-2 w-full rounded border border-line bg-ink p-3 text-slate-100";
export default function EEGLab({ controller }: { controller: LabController<EEGParameters, EEGResult> }) {
  const { state, initialize } = controller;
  const { values, result, loading, error, validation } = state;
  useEffect(() => { initialize(); }, [initialize]);
  const selected = values.channels.split(",").filter(Boolean);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Partial<Record<keyof EEGParameters, string>> = {};
    const numericKeys = values.mode === "compare" ? ["start_s", "end_s", "comparison_start_s", "comparison_end_s"] as const : ["start_s", "end_s"] as const;
    for (const key of numericKeys) {
      const n = Number(values[key]);
      if (!values[key].trim() || !Number.isFinite(n) || n < 2960 || n > 3080 || Math.abs(n * 256 - Math.round(n * 256)) > 1e-7) errors[key] = "Enter a time from 2960 to 3080 s aligned to 1/256 s.";
    }
    const duration = Number(values.end_s) - Number(values.start_s);
    if (duration < 2 || duration > 30) errors.end_s = "Choose a duration from 2 to 30 seconds.";
    if (values.mode === "compare" && Math.abs(Number(values.comparison_end_s) - Number(values.comparison_start_s) - duration) > 1e-7) errors.comparison_end_s = "Comparison windows must have equal durations.";
    if (!selected.length || selected.length > 4) errors.channels = "Select 1 to 4 channels.";
    controller.validate(errors);
    if (Object.keys(errors).length) {
      document.getElementById("eeg-" + Object.keys(errors)[0])?.focus();
      return;
    }
    void controller.run({ ...values, start_s: Number(values.start_s), end_s: Number(values.end_s), comparison_start_s: Number(values.comparison_start_s), comparison_end_s: Number(values.comparison_end_s) });
  }
  function preset(index: number, compare = false) {
    const p = eegPresets[index];
    controller.edit(compare ? "comparison_start_s" : "start_s", String(p.start));
    controller.edit(compare ? "comparison_end_s" : "end_s", String(p.end));
  }
  function timeInput(key: "start_s" | "end_s" | "comparison_start_s" | "comparison_end_s", label: string) {
    return <label className="block text-sm" key={key}>{label}<input id={"eeg-" + key} type="number" step="any" min="2960" max="3080" value={values[key]} onChange={e => controller.edit(key, e.target.value)} aria-invalid={!!validation[key]} aria-describedby={validation[key] ? "eeg-error-" + key : undefined} className={inputClass} />{validation[key] && <span id={"eeg-error-" + key} className="mt-2 block text-rose-300">{validation[key]}</span>}</label>;
  }
  return <section id="real-eeg" className="mx-auto max-w-7xl scroll-mt-32 px-6 py-14" aria-labelledby="eeg-title">
    <p className="label">LEVEL 4 / IMPLEMENTED</p><h2 id="eeg-title" className="section-title mt-3">Real EEG</h2>
    <div className="my-4 flex flex-wrap gap-3 text-xs font-bold text-mint"><span>REAL DATA</span><span>CHB-MIT / PHYSIONET</span></div>
    <p className="max-w-3xl text-muted">How do real scalp EEG recordings vary across time and channels, and how can clinically annotated seizure intervals be explored quantitatively?</p>
    <aside className="card my-6 border-amber-200/30 p-5 text-sm leading-relaxed">
      <p>This module is for computational neuroscience education and research exploration. It is not a medical device and does not diagnose, predict, or provide treatment recommendations for epilepsy.</p>
      <p className="mt-2">The seizure interval shown here is an annotation supplied by the source dataset, not a prediction made by NeuroSim Lab.</p>
    </aside>
    <div className="card p-6"><p className="label">Learn</p><h3 className="mt-3 text-xl font-bold">Simulated spikes are not EEG</h3>
      <div className="mt-4 grid gap-5 md:grid-cols-2"><p className="text-sm text-muted">Phase 2 / 3 uses simulated neurons, explicit spike times, synaptic interactions and population firing-rate summaries. A spike raster from the simulated network is not an EEG signal.</p>
      <p className="text-sm text-muted">Phase 4 contains scalp voltage measurements: aggregate electrophysiological activity, real measurement noise and biological complexity. Individual neuronal spikes cannot generally be directly identified from routine scalp EEG.</p></div>
      <p className="mt-4 text-sm text-muted">EEG channel labels represent electrode derivations, not individual neurons. These bipolar signals measure voltage differences between electrode pairs. A time series records voltage at successive samples: 256 samples per second here, about 3.90625 ms apart. Amplitude is calibrated in microvolts (uV), not normalized.</p>
    </div>
    <form noValidate onSubmit={submit} className="card my-6 space-y-5 p-6">
      <p className="label">Experiment</p>
      <label className="block text-sm">Recording<select aria-label="EEG recording" value={values.recording_id} onChange={e => controller.edit("recording_id", e.target.value)} className={inputClass}><option value="chb01_03">chb01_03.edf - case chb01</option></select></label>
      <fieldset id="eeg-channels" tabIndex={-1}><legend className="text-sm">Bipolar channels (select 1 to 4)</legend><div className="mt-3 flex flex-wrap gap-4">{eegChannels.map(c => <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(c)} disabled={!selected.includes(c) && selected.length >= 4} onChange={e => controller.edit("channels", (e.target.checked ? [...selected, c] : selected.filter(v => v !== c)).join(","))} />{c}</label>)}</div>{validation.channels && <p role="alert" className="text-rose-300">{validation.channels}</p>}</fieldset>
      <label className="block text-sm">View<select aria-label="EEG view" value={values.mode} onChange={e => controller.edit("mode", e.target.value)} className={inputClass}><option value="single">One real EEG window</option><option value="compare">Compare two real EEG windows</option></select></label>
      <fieldset><legend className="font-bold">Window A</legend><div className="my-3 flex flex-wrap gap-2">{eegPresets.map((p, i) => <button key={p.name} type="button" onClick={() => preset(i)} className="rounded border border-line px-3 py-2 text-xs hover:border-mint">{p.name}</button>)}</div><div className="grid gap-4 sm:grid-cols-2">{timeInput("start_s", "Window A start (s)")}{timeInput("end_s", "Window A end (s)")}</div></fieldset>
      {values.mode === "compare" && <fieldset><legend className="font-bold">Window B</legend><div className="my-3 flex flex-wrap gap-2">{eegPresets.map((p, i) => <button key={p.name} type="button" onClick={() => preset(i, true)} className="rounded border border-line px-3 py-2 text-xs hover:border-mint">{p.name}</button>)}</div><div className="grid gap-4 sm:grid-cols-2">{timeInput("comparison_start_s", "Window B start (s)")}{timeInput("comparison_end_s", "Window B end (s)")}</div></fieldset>}
      <p className="text-sm text-muted">Stored interval: [2960, 3080) s from recording start. Choose 2 to 30 seconds per window. Presets set drafts; select Load EEG to apply. Comparisons use identical channels and equal durations.</p>
      <button type="submit" disabled={loading} className="rounded bg-mint px-5 py-3 font-bold text-ink disabled:opacity-50">{loading ? "Loading real EEG..." : "Load EEG"}</button>
      {loading && <p role="status">Reading the real EEG teaching subset...</p>}
      {error && <p role="alert" className="text-rose-300">{error} No synthetic fallback is used. Retry with Load EEG.</p>}
    </form>
    {result && <div className="space-y-6" data-testid="eeg-results">
      <div><p className="label">Observe / Last loaded results</p><p className="mt-3 text-sm text-muted">Draft changes apply on Load EEG. Results below retain their own channel and interval labels. Samples use [start, end); the end point is excluded. All displayed samples are at 256 Hz. Waveforms share an amplitude scale across channels and windows; PSD plots also share a scale.</p></div>
      {result.windows.length === 2 && <p className="card p-5 text-sm">Differences observed in a single recording or subject do not establish a generalizable seizure biomarker. This comparison has no predictive validity claim.</p>}
      <div className="grid gap-6">{result.windows.map((w, i) => <article key={i} className="card min-w-0 overflow-hidden p-4 sm:p-6">
        <h3 className="text-lg font-bold">Window {i === 0 ? "A" : "B"}: {w.start_s}-{w.end_s} s</h3>
        <p className="my-3 text-sm text-muted">{w.sample_count} samples per channel. Dataset annotation: 2996-3036 s; shading shows its intersection with this window.</p>
        <EEGPlot window={w} result={result} />
        <div className="my-5 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="mb-3 text-left text-sm font-bold">Descriptive features from full-rate calibrated samples</caption><thead><tr><th className="p-2">Channel</th>{metrics.map(m => <th key={m.key} className="p-2">{m.name}</th>)}</tr></thead><tbody>{w.channels.map(c => <tr key={c.name} className="border-t border-line"><th className="p-2">{c.name}</th>{metrics.map(m => <td className="p-2" key={m.key}>{c.features[m.key].toPrecision(5)}</td>)}</tr>)}</tbody></table></div>
        <h4 className="font-bold">Welch power spectral density</h4><EEGPlot window={w} result={result} spectrum />
        <p className="text-xs text-muted">{w.channels[0].psd.segment_count} averaged segments per channel; power density, not probability.</p>
      </article>)}</div>
      <section className="card p-6" aria-labelledby="eeg-provenance"><h3 id="eeg-provenance" className="text-xl font-bold">Data Provenance</h3>
        <dl className="mt-4 space-y-3 break-words text-sm">
          <div><dt className="font-bold">Dataset / provider / version</dt><dd><a className="text-mint underline" href={result.provenance.dataset_url}>{result.provenance.dataset} / {result.provenance.provider} / {result.provenance.dataset_version}</a> - DOI {result.provenance.doi}</dd></div>
          <div><dt className="font-bold">Source / sampling / units</dt><dd><a className="text-mint underline" href={result.provenance.source_url}>{result.provenance.source_recording}</a> / {result.provenance.sampling_hz} Hz / {result.provenance.unit} (microvolts). EDF digital counts converted using its physical/digital calibration.</dd></div>
          <div><dt className="font-bold">Displayed channels / intervals</dt><dd>{result.windows[0].channels.map(c => c.name).join(", ")}; {result.windows.map(w => "[" + w.start_s + ", " + w.end_s + ") s").join(" versus ")}</dd></div>
          <div><dt className="font-bold">Dataset annotation</dt><dd><a href={result.provenance.annotation_url} className="text-mint underline">2996-3036 s, official case summary</a></dd></div>
          <div><dt className="font-bold">Processing</dt><dd>{result.provenance.preprocessing} No visualization downsampling. Welch alone removes each segment mean. {result.provenance.calibration}</dd></div>
          <div><dt className="font-bold">Source EDF prefilter field</dt><dd>{result.provenance.channels.filter(c => result.windows[0].channels.some(w => w.name === c.name)).map(c => c.name + ": " + (c.source_prefilter.trim() || "not specified")).join("; ")}. This describes source acquisition metadata, not a filter added by NeuroSim.</dd></div>
          <div><dt className="font-bold">Derived subset</dt><dd>{result.provenance.artifact}; {result.provenance.artifact_format}; {result.provenance.artifact_bytes} bytes; stored [{result.provenance.stored_start_s}, {result.provenance.stored_end_s}) s. Eight selected derivations; T8-P8 uses the first occurrence (source index 14).</dd></div>
          <div><dt className="font-bold">Source SHA-256</dt><dd className="break-all">{result.provenance.source_sha256}</dd></div>
          <div><dt className="font-bold">Artifact SHA-256</dt><dd className="break-all">{result.provenance.artifact_sha256}</dd></div>
          <div><dt className="font-bold">Attribution / license</dt><dd>{result.provenance.citation} <a href={result.provenance.license_url} className="text-mint underline">{result.provenance.license}</a></dd></div>
        </dl><p className="mt-4 text-sm text-muted">The dataset contains scalp EEG from pediatric subjects with intractable seizures. Recording dates are surrogates; only elapsed recording time is used. One recording cannot represent all patients or seizure types.</p>
      </section>
    </div>}
    <section className="card mt-6 p-6"><p className="label">Explain</p><h3 className="mt-3 text-xl font-bold">What the measurements mean</h3><dl className="mt-4 space-y-3 text-sm text-muted">{metrics.map(m => <div key={m.key}><dt className="font-bold text-slate-100">{m.name}</dt><dd>{m.definition}</dd></div>)}</dl>
      <p className="mt-5 text-sm text-muted">Welch PSD averages one-sided density periodograms using 256 Hz sampling, 512-sample (2 s) periodic Hann segments, 256-sample (50%) overlap, segment-mean detrending, 512-point FFT without zero padding, and arithmetic averaging. Frequency bins are 0.5 Hz apart; windowing broadens effective resolution. Frequencies run to the 128 Hz Nyquist limit. A full-window PSD summarizes frequency content and hides within-window timing. Longer segments improve frequency discrimination but provide fewer averages and coarser temporal localization. Noise, movement and line interference can contribute power; no band uniquely identifies epilepsy. No additional filtering or band-power interpretation is applied.</p>
    </section>
    <section className="card mt-6 p-6"><p className="label">Research</p><h3 className="mt-3 text-xl font-bold">From windows to research questions</h3><p className="mt-3 text-sm text-muted">These traceable windows and descriptive features can later become inputs to machine-learning and seizure-forecasting research. That requires defined labels, multiple subjects and seizures, leakage-safe splits and independent validation. Before annotated seizure is a time location, not a defined predictive state. Level 5 - Seizure Forecasting is the next development stage; forecasting is not implemented.</p></section>
  </section>;
}
