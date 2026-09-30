"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Data } from "plotly.js";
import Chart from "./Chart";

type Parameters = {
  neuron_count: number;
  excitatory_fraction: number;
  connection_probability: number;
  excitatory_weight_mv: number;
  inhibitory_weight_mv: number;
  external_drive_mv: number;
  duration_ms: number;
  seed: number;
};
type Result = {
  kind: "simulation";
  model_name: string;
  engine_version: string;
  execution_time_ms: number;
  parameters: Parameters;
  populations: {
    neuron_count: number; excitatory_count: number; inhibitory_count: number;
    connection_count: number; actual_excitatory_fraction: number;
  };
  spike_times_ms: number[];
  neuron_indices: number[];
  rates: { bin_width_ms: number; time_ms: number[]; excitatory_hz: number[]; inhibitory_hz: number[]; total_hz: number[] };
  summary: {
    total_spikes: number; mean_firing_rate_hz: number; excitatory_mean_firing_rate_hz: number;
    inhibitory_mean_firing_rate_hz: number; population_rate_cv: number | null;
  };
};
const defaults: Parameters = {
  neuron_count: 100, excitatory_fraction: 0.8, connection_probability: 0.1,
  excitatory_weight_mv: 0.5, inhibitory_weight_mv: 2, external_drive_mv: 22, duration_ms: 500, seed: 42,
};
const controls: { key: keyof Parameters; label: string; unit: string; min: number; max: number; step: number; help: string }[] = [
  { key: "neuron_count", label: "Network size", unit: "neurons", min: 20, max: 200, step: 1, help: "The number of simulated neurons in the network. This is a computational model size, not the number of neurons in a biological brain region." },
  { key: "excitatory_fraction", label: "Excitatory fraction", unit: "0-1", min: 0.5, max: 0.9, step: 0.01, help: "Excitatory neurons increase the probability that connected neurons will fire. Inhibitory neurons reduce the probability that connected neurons will fire." },
  { key: "connection_probability", label: "Connection probability", unit: "0-1", min: 0, max: 0.3, step: 0.01, help: "Higher connectivity allows activity to spread through more pathways in the simulated network. Self-connections are excluded." },
  { key: "excitatory_weight_mv", label: "Excitatory synaptic weight", unit: "mV / spike", min: 0, max: 2, step: 0.1, help: "Stronger excitatory synapses increase the effect of incoming excitatory spikes." },
  { key: "inhibitory_weight_mv", label: "Inhibitory synaptic weight", unit: "mV / spike", min: 0, max: 8, step: 0.1, help: "Stronger inhibitory synapses suppress postsynaptic activity more strongly. This positive magnitude is subtracted from voltage." },
  { key: "external_drive_mv", label: "External drive (R x I)", unit: "mV", min: 0, max: 40, step: 1, help: "External drive represents input arriving from outside the simulated network. It uses the same voltage-drive concept as the Single Neuron Lab, with fixed seeded fluctuations added." },
  { key: "duration_ms", label: "Simulation duration", unit: "ms", min: 50, max: 1000, step: 5, help: "Longer runs show more population activity. Network size x duration must stay at or below 100,000 neuron-ms." },
  { key: "seed", label: "Random seed", unit: "integer", min: 0, max: 4294967295, step: 1, help: "The same seed and parameters should reproduce the same connectivity and stochastic input within the same software environment." },
];
const learning = [
  ["Learn", "A synapse conveys a spike’s influence to another neuron. Excitation promotes firing; inhibition suppresses it. E/I balance depends on strengths, activity, and connectivity as well as cell counts."],
  ["Experiment", "Change E/I composition, synaptic strength, connectivity, or external drive. Change one parameter at a time to make comparisons interpretable."],
  ["Observe", "Compare the spike raster, E/I population firing rates, and population-rate variability. Look for activity spread across time or concentrated into shared bursts."],
  ["Explain", "Individual neurons follow relatively simple rules, but interactions among many neurons can generate collective network behavior."],
  ["Research", "Use controlled, reproducible experiments to ask how network interactions alter population dynamics. These outputs do not establish biological validity."],
];
const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

function NetworkResults({ result }: { result: Result }) {
  const { parameters: p, populations: pop, summary: s, rates } = result;
  const raster = useMemo<Data[]>(() => {
    const ex: number[] = [], ey: number[] = [], ix: number[] = [], iy: number[] = [];
    result.neuron_indices.forEach((id, index) => {
      if (id < pop.excitatory_count) { ex.push(result.spike_times_ms[index]); ey.push(id); }
      else { ix.push(result.spike_times_ms[index]); iy.push(id); }
    });
    return [
      { x: ex, y: ey, name: "Excitatory", type: "scatter", mode: "markers", marker: { color: "#91e6cb", size: 5, symbol: "line-ns-open" } },
      { x: ix, y: iy, name: "Inhibitory", type: "scatter", mode: "markers", marker: { color: "#e7bb80", size: 5, symbol: "line-ns-open" } },
    ];
  }, [result, pop.excitatory_count]);
  const rateData = useMemo<Data[]>(() => [
    { x: rates.time_ms, y: rates.excitatory_hz, name: "Excitatory", type: "scatter", mode: "lines", line: { color: "#91e6cb", width: 2, shape: "hvh" } },
    { x: rates.time_ms, y: rates.inhibitory_hz, name: "Inhibitory", type: "scatter", mode: "lines", line: { color: "#e7bb80", width: 2, dash: "dot", shape: "hvh" } },
  ], [rates]);
  const xRange = useMemo<[number, number]>(() => [0, p.duration_ms], [p.duration_ms]);
  const yRange = useMemo<[number, number]>(() => [-0.5, pop.neuron_count - 0.5], [pop.neuron_count]);
  const metrics = [
    ["Total spikes", number(s.total_spikes)], ["Mean rate / neuron", `${number(s.mean_firing_rate_hz)} Hz`],
    ["Excitatory mean rate", `${number(s.excitatory_mean_firing_rate_hz)} Hz`], ["Inhibitory mean rate", `${number(s.inhibitory_mean_firing_rate_hz)} Hz`],
    ["Population-rate CV", s.population_rate_cv === null ? "Undefined (silent)" : number(s.population_rate_cv)],
    ["Neurons (E / I)", `${pop.neuron_count} (${pop.excitatory_count} / ${pop.inhibitory_count})`],
    ["Directed connections", number(pop.connection_count)], ["Random seed", String(p.seed)],
  ];
  return <div className="min-w-0 space-y-5" data-testid="network-results">
    <div className="card p-5">
      <p className="label">Simulated spike activity</p><h3 className="mt-2 font-semibold">Spike raster</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">Each mark represents one simulated action potential. Patterns across many neurons reveal population activity that cannot be observed from a single membrane trace.</p>
      <Chart data={raster} yTitle="Neuron index (0-based)" showLegend xRange={xRange} yRange={yRange} />
      {s.total_spikes === 0 && <p className="text-sm text-muted">No spikes occurred in this run. The empty raster is a valid simulation result.</p>}
    </div>
    <div className="card p-5">
      <p className="label">Simulated population activity</p><h3 className="mt-2 font-semibold">Population firing rate</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">Population firing rate summarizes how many neurons are active over time. Each trace is normalized by its population size, in non-overlapping {rates.bin_width_ms} ms bins.</p>
      <Chart data={rateData} yTitle="Rate / neuron (Hz)" showLegend xRange={xRange} />
    </div>
    <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metrics.map(([label, value]) => <div className="card p-4" key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-2 text-lg font-bold text-mint">{value}</dd></div>)}</dl>
    <div className="card p-5">
      <h3 className="font-semibold">Interpreting synchronization</h3>
      <p className="mt-3 text-sm leading-relaxed">Synchronization describes the extent to which many neurons become active together. High synchronization is not automatically pathological.</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">Population-rate CV = standard deviation of the total population rate / its mean, across all 5 ms bins (population standard deviation, ddof = 0). Higher values indicate more uneven activity across time; zero means equal counts in every bin. Silence is undefined.</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">This is a basic synchronization proxy, not a pairwise synchrony measurement. Sparse firing, bin width, network size, shared input, and startup transients affect it. Compare matched settings; do not interpret it as a clinical score.</p>
      <p className="mt-3 text-xs text-muted">Run duration: {p.duration_ms} ms | Brian2 {result.engine_version} | Execution: {number(result.execution_time_ms)} ms. Timing is not part of deterministic output.</p>
    </div>
  </div>;
}

export default function NetworkLab() {
  // Strings preserve empty/partial edits, so clearing a field cannot silently become zero.
  const [values, setValues] = useState<Record<keyof Parameters, string>>(() => Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, String(v)])) as Record<keyof Parameters, string>);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const params = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) as Parameters;
  const exceedsBudget = params.neuron_count * params.duration_ms > 100000;
  const changed = result && controls.some(({ key }) => params[key] !== result.parameters[key]);
  const exc = Math.floor(params.neuron_count * params.excitatory_fraction + 0.5);

  async function run() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError("");
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch("/api/network", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params), signal: controller.signal });
      if (!response.ok) {
        if (response.status === 422) throw new Error("Check the parameter ranges and the 100,000 neuron-ms limit.");
        if (response.status === 503) {
          const body = await response.json().catch(() => null);
          throw new Error(typeof body?.detail === "string" ? body.detail : "The network simulator is busy. Please retry shortly.");
        }
        throw new Error("The network simulation service is unavailable. Please try again.");
      }
      setResult(await response.json());
    } catch (e) {
      setError(controller.signal.aborted ? "The request timed out. Try a smaller network or retry shortly." : e instanceof Error ? e.message : "Could not run the network simulation.");
    } finally {
      clearTimeout(timeout); pending.current = null; setLoading(false);
    }
  }

  return <section id="network-lab" className="scroll-mt-24 border-y border-line bg-[#0e1721]">
    <div className="mx-auto max-w-7xl px-6 py-20">
      <div className="flex flex-wrap items-center gap-4"><p className="label">Level 2 / Implemented</p><span className="rounded-full border border-mint/50 bg-mint/10 px-3 py-1 text-xs font-bold text-mint">SIMULATED</span></div>
      <h2 className="section-title mt-3">Neural Network Dynamics</h2>
      <p className="mt-3 max-w-3xl text-muted">What changes when we move from one neuron to interacting populations of neurons? Explore how excitation, inhibition, and connectivity create collective activity in a small recurrent LIF network.</p>
      <dl className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">{learning.map(([term, text]) => <div className="border-l border-line pl-3" key={term}><dt className="label">{term}</dt><dd className="mt-2 text-xs leading-relaxed text-muted">{text}</dd></div>)}</dl>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <a href="#neuron-lab" className="card block p-5 hover:border-mint"><p className="label">Single Neuron Lab</p><h3 className="mt-2 font-semibold">How does one neuron generate spikes?</h3><p className="mt-2 text-sm text-muted">Observe membrane potential, threshold, and spike timing.</p><span className="mt-3 inline-block text-sm text-mint">&larr; Revisit Level 1</span></a>
        <div className="card p-5"><p className="label">Neural Network Lab</p><h3 className="mt-2 font-semibold">What happens when many neurons interact?</h3><p className="mt-2 text-sm text-muted">Observe population activity, excitation/inhibition, synchronization, and emergent dynamics.</p><p className="mt-3 text-sm text-muted"><strong className="text-white">Emergent dynamics:</strong> Network behavior that arises from interactions among neurons and cannot be understood by observing one neuron alone.</p></div>
      </div>
      <figure className="card mt-8 p-5">
        <figcaption className="label">Conceptual network model</figcaption>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-center text-sm">
          <div className="rounded-lg border border-line px-4 py-3">External input<br /><span className="text-xs text-muted">Drive + seeded fluctuations</span></div>
          <span className="text-mint" aria-hidden="true">&rarr;</span>
          <div className="rounded-lg border border-mint/50 px-4 py-3 text-mint">Excitatory neurons<br /><span className="text-xs">Positive synaptic influence (+)</span></div>
          <div className="text-xs text-muted"><span className="text-xl" aria-hidden="true">&harr;</span><br />E &rarr; I (+) | I &rarr; E (-)</div>
          <div className="rounded-lg border border-[#e7bb80]/50 px-4 py-3 text-[#e7bb80]">Inhibitory neurons<br /><span className="text-xs">Negative synaptic influence (-)</span></div>
        </div>
        <p className="mt-4 text-center text-xs leading-relaxed text-muted">External input reaches both populations. Directed random connections occur within and between E and I populations; each neuron’s output sign follows its population. This diagram is computational, not anatomical.</p>
      </figure>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <form className="card p-5" onSubmit={e => { e.preventDefault(); void run(); }}>
          <h3 className="font-semibold">Network parameters</h3>
          <fieldset disabled={loading} className="mt-5 space-y-5 disabled:opacity-60">
            <legend className="sr-only">Configure the simulated network</legend>
            {controls.map(({ key, label, unit, min, max, step, help }) => <div key={key}>
              <label htmlFor={`network-${key}`} className="mb-1 flex justify-between gap-2 text-sm text-muted"><span>{label}</span><span className="shrink-0 text-xs">{unit}</span></label>
              <input id={`network-${key}`} type="number" required min={min} max={max} step={step} value={values[key]} aria-describedby={`network-${key}-help`} onChange={e => setValues({ ...values, [key]: e.target.value })} className="w-full rounded-md border border-line bg-ink px-3 py-2 text-white" />
              <p id={`network-${key}-help`} className="mt-2 text-xs leading-relaxed text-muted">{help}</p>
              {key === "excitatory_fraction" && <p className="mt-2 text-xs text-mint">Derived inhibitory fraction: {number((1 - params.excitatory_fraction) * 100)}%. Rounded populations: {exc} E / {params.neuron_count - exc} I.</p>}
            </div>)}
          </fieldset>
          <p className={`mt-4 text-xs ${exceedsBudget ? "text-rose-300" : "text-muted"}`} aria-live="polite">Work budget: {number(params.neuron_count * params.duration_ms)} / 100,000 neuron-ms.{exceedsBudget && " Reduce size or duration."}</p>
          <button type="submit" disabled={loading || exceedsBudget} className="mt-5 w-full rounded-md bg-mint px-4 py-3 font-bold text-ink disabled:opacity-60">{loading ? "Simulating network..." : "Run network simulation"}</button>
          <p className="mt-3 text-xs leading-relaxed text-muted">The 80/20 default is an educational choice, not a universal ratio across brain regions. All runs are simulated.</p>
        </form>
        <div className="min-w-0 space-y-4" aria-busy={loading}>
          <p role="status" className="text-sm text-muted">{loading ? "Running the network model..." : changed ? "Parameters changed. Plots and metrics show the last completed run; run again to update." : result ? "Showing the completed simulation for the parameters at left." : "Choose parameters and run the model to see simulated population activity."}</p>
          {error && <p role="alert" className="rounded border border-rose-700 p-3 text-rose-300">{error}</p>}
          {result ? <NetworkResults result={result} /> : <div className="card px-6 py-16 text-center"><p className="label">Simulated outputs</p><p className="mt-3 text-muted">Spike raster | E/I population rates | Summary metrics</p><p className="mt-3 text-sm text-muted">Run a baseline, then change one parameter and compare the patterns.</p></div>}
        </div>
      </div>
      <details className="card mt-8 p-5">
        <summary className="cursor-pointer font-semibold">Model, evidence, and limitations</summary>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <p>Each LIF neuron follows tau_m dV/dt = -(V - Vrest) + D + noise_i(t). tau_m = 20 ms, rest/reset = -65 mV, threshold = -50 mV, refractory period = 2 ms, Euler step = 0.2 ms. Initial voltages are independently uniform between rest and threshold.</p>
          <p>Connections are independently sampled for each directed pair, without self-connections. After a fixed 1 ms delay, a spike adds the excitatory weight or subtracts the inhibitory magnitude from the target voltage. Voltage remains clamped during refractoriness. There is no synaptic plasticity.</p>
          <p>External input adds independent zero-mean Gaussian voltage-drive fluctuations (standard deviation 4 mV), resampled every 1 ms and held between samples. It is a simplified input model, not a measured signal. Rates and CV include startup transients.</p>
          <p>This simplified network is designed to study computational principles of excitation, inhibition, connectivity, and collective activity. It is not a patient-specific or anatomically complete model. Network spikes are not EEG, and synchronized firing is not a seizure.</p>
          <p>One seed controls separate streams for connectivity, input, and starting voltages. Reproducibility applies within the same supported software environment; numerical and event timing differences can occur across versions and platforms.</p>
          <a className="inline-block text-mint underline" href="https://brian2.readthedocs.io/en/2.10.1/" target="_blank" rel="noreferrer">Brian2 model documentation &nearr;</a>
        </div>
      </details>
      <aside className="mt-8 rounded-xl border border-line p-6">
        <p className="label">Next Stage &mdash; Epilepsy Dynamics &middot; Planned</p>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted">When excitation, inhibition, connectivity, or synchronization change, network dynamics may shift into qualitatively different states. The next research stage will investigate how such transitions relate to seizure-like dynamics.</p>
      </aside>
    </div>
  </section>;
}
