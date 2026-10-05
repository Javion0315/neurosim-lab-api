"use client";

import { useEffect, useMemo } from "react";
import Chart from "./Chart";
import { controls, NetworkResults } from "./NetworkLab";
import { defaults, type Comparison, type Experiment } from "./network-client";
import { readNumber, validateNumbers, focusInvalid } from "./numeric-input";
import type { LabController } from "./useLabSession";

const keys: (keyof Experiment)[] = ["excitatory_weight_mv", "inhibitory_weight_mv", "connection_probability", "external_drive_mv"];
const experimentControls = controls.filter(c => keys.includes(c.key as keyof Experiment));
export const reference: Experiment = {
  excitatory_weight_mv: defaults.excitatory_weight_mv, inhibitory_weight_mv: defaults.inhibitory_weight_mv,
  connection_probability: defaults.connection_probability, external_drive_mv: defaults.external_drive_mv,
};
const presets: { label: string; changes: Partial<Experiment>; description: string }[] = [
  { label: "Reference", changes: {}, description: "No parameter changes." },
  { label: "Increased excitation", changes: { excitatory_weight_mv: 0.75 }, description: "Excitatory strength: 0.5 to 0.75 mV/spike (+50%). All other parameters fixed." },
  { label: "Reduced inhibition", changes: { inhibitory_weight_mv: 1 }, description: "Inhibitory magnitude: 2 to 1 mV/spike (-50%). All other parameters fixed." },
  { label: "Increased connectivity", changes: { connection_probability: 0.15 }, description: "Connection probability: 0.10 to 0.15 (+50%). All other parameters fixed." },
  { label: "Increased external drive", changes: { external_drive_mv: 26 }, description: "External drive: 22 to 26 mV (+4 mV). All other parameters fixed." },
];
const timeRange: [number, number] = [0, 500];
const fractionRange: [number, number] = [0, 1];
const fmt = (n: number | null) => n === null ? "Undefined (silent)" : n.toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function DynamicsLab({ controller }: { controller: LabController<Experiment, Comparison> }) {
  const { values, result, loading, error, validation } = controller.state;
  const { initialize } = controller;
  useEffect(() => initialize(), [initialize]);
  const stale = result && keys.some(k => readNumber(values[k]) !== result.experimental.network.parameters[k]);
  const draftChanges = keys.filter(k => readNumber(values[k]) !== reference[k]);
  const comparisonMode = draftChanges.length > 0;
  const haveExperiment = Boolean(comparisonMode && result && result.changes.length && !stale);
  const rateRange = useMemo<[number, number]>(() => [0, result ? Math.max(1,
    ...result.reference.network.rates.excitatory_hz, ...result.reference.network.rates.inhibitory_hz,
    ...(haveExperiment ? result.experimental.network.rates.excitatory_hz : []), ...(haveExperiment ? result.experimental.network.rates.inhibitory_hz : [])) * 1.05 : 1], [result, haveExperiment]);
  const participation = useMemo(() => result ? [
    { x: result.reference.network.rates.time_ms, y: result.reference.coordination.active_fraction, name: "Reference", type: "scatter" as const, mode: "lines" as const, line: { color: "#91e6cb", shape: "hvh" as const } },
    ...(haveExperiment ? [{ x: result.experimental.network.rates.time_ms, y: result.experimental.coordination.active_fraction, name: "Experimental", type: "scatter" as const, mode: "lines" as const, line: { color: "#e7bb80", dash: "dot" as const, shape: "hvh" as const } }] : []),
  ] : [], [result, haveExperiment]);
  async function run(form: HTMLFormElement) {
    const rules = experimentControls.map(c => ({ ...c, key: c.key as keyof Experiment }));
    const check = validateNumbers(values, rules);
    controller.validate(check.errors);
    if (!check.parameters) { focusInvalid(form); return; }
    await controller.run(check.parameters);
  }
  const rows = result ? [
    ["Mean firing rate (Hz/neuron)", result.reference.network.summary.mean_firing_rate_hz, result.experimental.network.summary.mean_firing_rate_hz],
    ["E firing rate (Hz/neuron)", result.reference.network.summary.excitatory_mean_firing_rate_hz, result.experimental.network.summary.excitatory_mean_firing_rate_hz],
    ["I firing rate (Hz/neuron)", result.reference.network.summary.inhibitory_mean_firing_rate_hz, result.experimental.network.summary.inhibitory_mean_firing_rate_hz],
    ["Population-rate CV", result.reference.network.summary.population_rate_cv, result.experimental.network.summary.population_rate_cv],
    ["Mean active fraction", result.reference.coordination.mean_active_fraction, result.experimental.coordination.mean_active_fraction],
    ["Peak active fraction", result.reference.coordination.peak_active_fraction, result.experimental.coordination.peak_active_fraction],
  ] as [string, number | null, number | null][] : [];

  return <section id="epilepsy-dynamics" className="scroll-mt-24 border-b border-line">
    <div className="mx-auto max-w-7xl px-6 py-20">
      <p className="label">Level 3 / Implemented</p>
      <h2 className="section-title mt-3">Epilepsy Dynamics</h2>
      <div className="mt-4 flex flex-wrap gap-2">{["SIMULATED", "NETWORK DYNAMICS", "SEIZURE-LIKE DYNAMICS"].map(label => <span key={label} className="rounded-full border border-mint/50 bg-mint/10 px-3 py-1 text-xs font-bold text-mint">{label}</span>)}</div>
      <p className="mt-4 max-w-3xl text-muted">Explore how changes in network parameters can shift simulated neural populations between different dynamical regimes.</p>
      <aside className="mt-6 rounded-xl border border-amber-300/40 bg-amber-300/5 p-5 text-sm leading-relaxed">
        This model studies computational mechanisms that can produce seizure-like population dynamics. It does not reproduce the full biological complexity of epilepsy and cannot diagnose, predict, or represent an individual patient&apos;s seizures.
      </aside>
      <dl className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">{[
        ["Learn", "Interacting neurons generate emergent population dynamics. A network state transition is a change in collective network behavior that emerges when underlying parameters or interactions change."],
        ["Experiment", "Can gradual parameter changes produce qualitative changes? Start with one variable at a time; try intermediate values. Epilepsy cannot be reduced to one parameter."],
        ["Observe", "Compare distributed spikes across neurons and time with coordinated activity in shared windows. Examine E/I rates, temporal variability, and participation without assuming an outcome."],
        ["Explain", "Excitation, inhibition, connectivity, input, intrinsic dynamics, and architecture interact. More activity, larger fluctuations, or sustained peaks describe a computation, not a diagnosis."],
        ["Research", "Simulated seizure-like dynamics require future comparison with real electrophysiological recordings and a justified observation model. Spikes and population firing rates are not EEG."],
      ].map(([label, text]) => <div className="border-l border-line pl-3" key={label}><dt className="label">{label}</dt><dd className="mt-2 text-xs leading-relaxed text-muted">{text}</dd></div>)}</dl>

      <form noValidate className="card mt-8 p-5" onSubmit={e => { e.preventDefault(); void run(e.currentTarget); }}>
        <h3 className="font-semibold">Experimental condition</h3>
        <p className="mt-2 text-sm text-muted">Reference Network: the exact Phase 2 defaults. Fixed at 100 neurons (80 E / 20 I), 500 ms, seed 42. These modest presets are controlled computational experiments; no outcome is guaranteed.</p>
        <fieldset disabled={loading} className="mt-5 disabled:opacity-60">
          <legend className="sr-only">Configure experiment</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{presets.map(preset => <button key={preset.label} type="button" className="rounded-lg border border-line p-3 text-left hover:border-mint" onClick={() => controller.choose({ ...reference, ...preset.changes })}><span className="text-sm font-semibold text-mint">{preset.label}</span><span className="mt-2 block text-xs leading-relaxed text-muted">{preset.description}</span></button>)}</div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{experimentControls.map(c => {
            const key = c.key as keyof Experiment;
            return <label key={key} className="block text-sm text-muted">{c.label}<span className="ml-2 text-xs">({c.unit})</span>
              <input aria-label={"Experimental " + c.label} required type="number" min={c.min} max={c.max} step={key === "excitatory_weight_mv" ? 0.05 : c.step} value={values[key]} id={"experimental-" + key} aria-invalid={Boolean(validation[key])} aria-describedby={validation[key] ? "experimental-" + key + "-error" : undefined} onChange={e => controller.edit(key, e.target.value)} className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-2 text-white" />
              {validation[key] && <span id={"experimental-" + key + "-error"} className="mt-2 block text-xs text-rose-300">{validation[key]}</span>}
              <span className="mt-2 block text-xs">Reference: {reference[key]} {c.unit}</span>
            </label>;
          })}</div>
        </fieldset>
        <p className="mt-4 text-sm text-muted">Pending changes: {draftChanges.length ? draftChanges.map(k => experimentControls.find(c => c.key === k)?.label + ": " + reference[k] + " -> " + (values[k] || "(empty)") + " " + experimentControls.find(c => c.key === k)?.unit).join("; ") : "none; reproduce the reference."}</p>
        {draftChanges.length > 1 && <p className="mt-2 text-sm text-amber-200">Multiple parameters differ. To isolate a mechanism, choose a preset and vary one parameter.</p>}
        {Object.values(validation).some(Boolean) && <p role="alert" className="mt-3 text-sm text-rose-300">Check the highlighted parameters before running.</p>}
        <button type="submit" disabled={loading} className="mt-5 rounded-md bg-mint px-5 py-3 font-bold text-ink disabled:opacity-60">{loading ? "Simulating comparison..." : "Run comparison"}</button>
      </form>

      <div className="mt-6 space-y-5" aria-busy={loading} data-testid="dynamics-results">
        <p role="status" className="text-sm text-muted">{loading ? "Generating the matched reference and experimental conditions..." : result && !comparisonMode ? "Reference baseline established. Choose an experimental condition or change a parameter to compare network dynamics." : stale ? "Parameters changed. Run comparison to generate matching experimental results." : result ? "Showing the completed comparison." : "Run comparison to retry loading the reference."}</p>
        {error && <p role="alert" className="rounded border border-rose-700 p-3 text-rose-300">{error}</p>}
        {result && <>
          {comparisonMode && <div className="card p-5" data-testid="comparison-table">
            <h3 className="font-semibold">Measured network state</h3>
            <p className="mt-2 text-sm text-muted">{haveExperiment ? "Completed changes: " + result.changes.map(c => experimentControls.find(control => control.key === c.parameter)?.label + ": " + c.reference + " -> " + c.experimental + " " + experimentControls.find(control => control.key === c.parameter)?.unit).join("; ") : "Experimental results pending. Run comparison after finishing your edits."}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{result.fixed_conditions}</p>
            <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Reference versus experimental measurements</caption><thead><tr className="border-b border-line"><th className="p-2">Measure</th><th className="p-2">Reference</th><th className="p-2">Experimental</th><th className="p-2">Difference</th></tr></thead><tbody>{rows.map(([label, a, b]) => <tr className="border-b border-line" key={label}><th className="p-2 font-normal text-muted">{label}</th><td className="p-2">{fmt(a)}</td><td className="p-2">{haveExperiment ? fmt(b) : "Not run"}</td><td className="p-2">{!haveExperiment ? "Not run" : a === null || b === null ? "Undefined" : (b > a ? "+" : "") + fmt(b - a)}</td></tr>)}</tbody></table></div>
            <p className="mt-4 text-sm text-muted">Differences are experimental minus reference, in the units shown. Higher or lower does not mean better, worse, or pathological. Read rate and participation together; these measurements do not prove a state transition.</p>
          </div>}
          <div data-testid={comparisonMode ? "comparison-view" : "reference-view"} className={comparisonMode ? "grid items-start gap-5 xl:grid-cols-2" : "min-w-0"}>
            <div className="min-w-0 space-y-4"><h3 className="text-xl font-bold">Reference Network</h3><NetworkResults result={result.reference.network} rateRange={rateRange} /></div>
            {comparisonMode && <div className="min-w-0 space-y-4"><h3 className="text-xl font-bold">Experimental Condition</h3>
              {haveExperiment ? <NetworkResults result={result.experimental.network} rateRange={rateRange} /> : <div className="card p-6 text-sm text-muted">Run comparison to generate results for the experimental condition. The Reference Network remains your comparison point.</div>}
            </div>}
          </div>
          <div className="card p-5"><h3 className="font-semibold">Temporal population participation</h3>
            <p className="mt-2 text-sm text-muted">Distinct active neurons / 100 in each 5 ms window. {haveExperiment ? "Reference and experimental traces use the same axes." : "Showing the Reference Network."}</p>
            {!comparisonMode && <dl className="mt-4 flex flex-wrap gap-8 text-sm"><div><dt className="text-muted">Mean active fraction</dt><dd className="mt-1 font-bold text-mint">{fmt(result.reference.coordination.mean_active_fraction)}</dd></div><div><dt className="text-muted">Peak active fraction</dt><dd className="mt-1 font-bold text-mint">{fmt(result.reference.coordination.peak_active_fraction)}</dd></div></dl>}
            <Chart data={participation} yTitle="Active fraction (0-1)" showLegend xRange={timeRange} yRange={fractionRange} />
          </div>
        </>}
      </div>
      <div className="card mt-8 space-y-3 p-5 text-sm leading-relaxed text-muted">
        <h3 className="font-semibold text-white">Interpretation, evidence, and limitations</h3>
        <p className="text-amber-200">A difference between two simulations is a computational result, not evidence of disease. No single synchronization metric determines whether a biological seizure is occurring.</p>
        <p>High firing rate alone is not a seizure. High synchronization alone is not a seizure. Reduced inhibition alone is not epilepsy. A simulated population burst is not automatically a biological seizure.</p>
        <p><strong className="text-white">Coordination definition:</strong> a[k] = distinct neurons with at least one spike in bin k / N. Mean active fraction = sum(a[k]) / K; peak active fraction = max(a[k]). All are bounded by 0 and 1, with 0 for silence. Repeated spikes from one neuron count once per bin. Higher participation measures temporal co-activity, not excess synchrony beyond chance.</p>
        <p>Bin width (fixed at 5 ms), bin alignment, firing rate, population size, run duration, and startup transients affect participation. Independently firing neurons can have high participation at high rates. Peak values are sensitive to a single window. Population-rate CV retains its Phase 2 definition and limitations. There is no pairwise correlation or seizure score.</p>
        <p><strong className="text-white">No burst classifier:</strong> peaks are measured activity, not labeled burst events. This LIF model has no intrinsic bursting or adaptation mechanism and has not demonstrated robust biologically meaningful bursting. It is retained for educational parameter comparisons; no neuron model upgrade was introduced.</p>
        <p>The model simplifies or omits realistic cell diversity, detailed ion channels, spatial anatomy, heterogeneous synaptic dynamics, realistic cortical connectivity, patient-specific parameters, seizure onset zones, extracellular field generation, and EEG forward modeling.</p>
        <p><strong className="text-white">SIMULATED RESULT:</strong> all plots and comparisons here. <strong className="text-white">REAL DATA:</strong> the DANDI explorer shows archive metadata only. <strong className="text-white">FUTURE VALIDATION:</strong> compare appropriate measurements with real epilepsy electrophysiology, accounting for observation models, uncertainty, and independent data.</p>
        <p>Same seed, software environment, initial voltages, and input fluctuations are used for each pair. Connectivity is identical for weight and drive changes. For a probability change, the same uniform random matrix is thresholded at the new probability, adding or removing edges without resampling all connections.</p>
        <a href="#real-eeg" className="inline-block text-mint underline">Continue to Level 4 - Real EEG</a>
      </div>
    </div>
  </section>;
}
