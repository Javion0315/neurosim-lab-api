"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "./Chart";
import { controls, NetworkResults } from "./NetworkLab";
import { defaults, loadBaseline, runComparison, type Comparison, type Experiment } from "./network-client";

const keys: (keyof Experiment)[] = ["excitatory_weight_mv", "inhibitory_weight_mv", "connection_probability", "external_drive_mv"];
const experimentControls = controls.filter(c => keys.includes(c.key as keyof Experiment));
const reference: Experiment = {
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
const strings = (p: Experiment) => Object.fromEntries(keys.map(k => [k, String(p[k])])) as Record<keyof Experiment, string>;
const fmt = (n: number | null) => n === null ? "Undefined (silent)" : n.toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function DynamicsLab() {
  const [values, setValues] = useState(() => strings(reference));
  const [result, setResult] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    void loadBaseline().then(data => { if (active) setResult(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load reference."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; };
  }, []);
  const params = Object.fromEntries(keys.map(k => [k, Number(values[k])])) as Experiment;
  const stale = result && keys.some(k => params[k] !== result.experimental.network.parameters[k]);
  const draftChanges = keys.filter(k => params[k] !== reference[k]);
  const rateRange = useMemo<[number, number]>(() => [0, result ? Math.max(1,
    ...result.reference.network.rates.excitatory_hz, ...result.reference.network.rates.inhibitory_hz,
    ...result.experimental.network.rates.excitatory_hz, ...result.experimental.network.rates.inhibitory_hz) * 1.05 : 1], [result]);
  const participation = useMemo(() => result ? [
    { x: result.reference.network.rates.time_ms, y: result.reference.coordination.active_fraction, name: "Reference", type: "scatter" as const, mode: "lines" as const, line: { color: "#91e6cb", shape: "hvh" as const } },
    { x: result.experimental.network.rates.time_ms, y: result.experimental.coordination.active_fraction, name: "Experimental", type: "scatter" as const, mode: "lines" as const, line: { color: "#e7bb80", dash: "dot" as const, shape: "hvh" as const } },
  ] : [], [result]);
  async function run() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true); setError("");
    try {
      const next = await runComparison(params);
      if (mounted.current) setResult(next);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      pending.current = false;
      if (mounted.current) setLoading(false);
    }
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

      <form className="card mt-8 p-5" onSubmit={e => { e.preventDefault(); void run(); }}>
        <h3 className="font-semibold">Experimental condition</h3>
        <p className="mt-2 text-sm text-muted">Reference Network: the exact Phase 2 defaults. Fixed at 100 neurons (80 E / 20 I), 500 ms, seed 42. These modest presets are controlled computational experiments; no outcome is guaranteed.</p>
        <fieldset disabled={loading} className="mt-5 disabled:opacity-60">
          <legend className="sr-only">Configure experiment</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{presets.map(preset => <button key={preset.label} type="button" className="rounded-lg border border-line p-3 text-left hover:border-mint" onClick={() => setValues(strings({ ...reference, ...preset.changes }))}><span className="text-sm font-semibold text-mint">{preset.label}</span><span className="mt-2 block text-xs leading-relaxed text-muted">{preset.description}</span></button>)}</div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{experimentControls.map(c => {
            const key = c.key as keyof Experiment;
            return <label key={key} className="block text-sm text-muted">{c.label}<span className="ml-2 text-xs">({c.unit})</span>
              <input aria-label={"Experimental " + c.label} required type="number" min={c.min} max={c.max} step={key === "excitatory_weight_mv" ? 0.05 : c.step} value={values[key]} onChange={e => setValues({ ...values, [key]: e.target.value })} className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-2 text-white" />
              <span className="mt-2 block text-xs">Reference: {reference[key]} {c.unit}</span>
            </label>;
          })}</div>
        </fieldset>
        <p className="mt-4 text-sm text-muted">Pending changes: {draftChanges.length ? draftChanges.map(k => experimentControls.find(c => c.key === k)?.label + ": " + reference[k] + " to " + (values[k] || "(empty)")).join("; ") : "none; reproduce the reference."}</p>
        {draftChanges.length > 1 && <p className="mt-2 text-sm text-amber-200">Multiple parameters differ. To isolate a mechanism, choose a preset and vary one parameter.</p>}
        <button disabled={loading} className="mt-5 rounded-md bg-mint px-5 py-3 font-bold text-ink disabled:opacity-60">{loading ? "Simulating comparison..." : "Run comparison"}</button>
      </form>

      <div className="mt-6 space-y-5" aria-busy={loading} data-testid="dynamics-results">
        <p role="status" className="text-sm text-muted">{loading ? "Generating the matched reference and experimental conditions..." : stale ? "Parameters changed. Results show the last completed comparison." : result ? "Showing the completed comparison." : "Run comparison to retry loading the reference."}</p>
        {error && <p role="alert" className="rounded border border-rose-700 p-3 text-rose-300">{error}</p>}
        {result && <>
          <div className="card p-5">
            <h3 className="font-semibold">Measured network state</h3>
            <p className="mt-2 text-sm text-muted">Completed changes: {result.changes.length ? result.changes.map(c => experimentControls.find(control => control.key === c.parameter)?.label + ": " + c.reference + " to " + c.experimental).join("; ") : "none (identical reference and experimental parameters)."}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{result.fixed_conditions}</p>
            <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Reference versus experimental measurements</caption><thead><tr className="border-b border-line"><th className="p-2">Measure</th><th className="p-2">Reference</th><th className="p-2">Experimental</th><th className="p-2">Difference</th></tr></thead><tbody>{rows.map(([label, a, b]) => <tr className="border-b border-line" key={label}><th className="p-2 font-normal text-muted">{label}</th><td className="p-2">{fmt(a)}</td><td className="p-2">{fmt(b)}</td><td className="p-2">{a === null || b === null ? "Undefined" : fmt(b - a)}</td></tr>)}</tbody></table></div>
            <p className="mt-4 text-sm text-muted">Read rate and participation together: higher rate means more spikes per second; higher peak participation means more distinct neurons active within at least one shared 5 ms window. These relative measurements do not assign clinical regions or prove a state transition.</p>
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-2">{[
            { label: "Reference Network", condition: result.reference }, { label: "Experimental condition", condition: result.experimental },
          ].map(({ label, condition }) => <div className="min-w-0 space-y-4" key={label}><h3 className="text-xl font-bold">{label}</h3><NetworkResults result={condition.network} rateRange={rateRange} /></div>)}</div>
          <div className="card p-5"><h3 className="font-semibold">Temporal population participation</h3>
            <p className="mt-2 text-sm text-muted">Distinct active neurons / 100 in each 5 ms window. Both conditions use the same axes; overlapping traces are expected for the reference preset.</p>
            <Chart data={participation} yTitle="Active fraction (0-1)" showLegend xRange={[0, 500]} yRange={[0, 1]} />
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
        <a href="/research-vision#roadmap" className="inline-block text-mint underline">Next development stage: Level 4 - Real EEG</a>
      </div>
    </div>
  </section>;
}
