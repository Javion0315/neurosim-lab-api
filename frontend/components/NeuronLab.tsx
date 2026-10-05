"use client";
import { useEffect } from "react";
import Chart from "./Chart";
import { ProgressionStrip } from "./ResearchRoadmap";
import { readNumber, validateNumbers, focusInvalid } from "./numeric-input";
import type { LabController } from "./useLabSession";

type Params = { input_drive_mv:number; tau_m_ms:number; v_rest_mv:number; v_threshold_mv:number; v_reset_mv:number; refractory_ms:number; duration_ms:number; seed:number };
export type Stats = { spike_count:number; firing_rate_hz:number; mean_isi_ms:number|null; cv_isi:number|null };
type Result = { kind:"simulation"; model_name:string; software_version:string; dt_ms:number; parameters:Params; time_ms:number[]; voltage_mv:number[]; spike_times_ms:number[]; statistics:Stats };
export const initial:Params = { input_drive_mv:22, tau_m_ms:20, v_rest_mv:-65, v_threshold_mv:-50, v_reset_mv:-65, refractory_ms:2, duration_ms:500, seed:42 };
const fields: { key:keyof Params; label:string; unit:string; step:number; min:number; max:number; integer?:boolean; exclusiveMin?:boolean }[] = [
  { key:"input_drive_mv",min:-100,max:100,label:"Input drive (R × I)",unit:"mV",step:1 }, { key:"tau_m_ms",min:0,max:200,exclusiveMin:true,label:"Membrane time constant",unit:"ms",step:1 },
  { key:"v_rest_mv",min:-100,max:30,label:"Resting potential",unit:"mV",step:1 }, { key:"v_threshold_mv",min:-100,max:50,label:"Threshold",unit:"mV",step:1 },
  { key:"v_reset_mv",min:-100,max:30,label:"Reset potential",unit:"mV",step:1 }, { key:"refractory_ms",min:0,max:50,label:"Refractory period",unit:"ms",step:.5 },
  { key:"duration_ms",min:20,max:2000,label:"Duration",unit:"ms",step:50 }, { key:"seed",min:0,max:4294967295,integer:true,label:"Random seed",unit:"",step:1 }
];

export async function runNeuron(parameters: Params): Promise<Result> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch("/api/lif", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parameters), signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 422 ? "Check parameter ranges and keep rest/reset below threshold." : "Simulation API unavailable. Please retry.");
    return await response.json();
  } finally { clearTimeout(timeout); }
}
let baseline: Promise<Result> | undefined;
export function loadNeuronBaseline() {
  if (!baseline) baseline = runNeuron(initial).catch(error => { baseline = undefined; throw error; });
  return baseline;
}
export default function NeuronLab({ controller }: { controller: LabController<Params, Result> }) {
  const { values, result, loading, error, validation } = controller.state;
  const { initialize } = controller;
  useEffect(() => initialize(), [initialize]);
  const changed = result && fields.some(({ key }) => readNumber(values[key]) !== result.parameters[key]);
  async function submit(form: HTMLFormElement) {
    const check = validateNumbers(values, fields);
    const p = check.parameters;
    if (p && p.v_rest_mv >= p.v_threshold_mv) check.errors.v_rest_mv = "Resting potential must be below threshold.";
    if (p && p.v_reset_mv >= p.v_threshold_mv) check.errors.v_reset_mv = "Reset potential must be below threshold.";
    controller.validate(check.errors);
    if (!p || Object.keys(check.errors).length) { focusInvalid(form); return; }
    await controller.run(p);
  }
  return <section id="neuron-lab" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20"><p className="label">Level 1 / Implemented</p><p className="mt-2 text-xs font-bold text-mint">SIMULATED</p><h2 className="section-title mt-3">Single Neuron Dynamics</h2><p className="mt-3 max-w-3xl text-muted">A leaky integrate-and-fire neuron accumulates a constant input drive, leaks toward rest, and emits a mathematical spike at threshold. The reset is a model rule, not the shape of a biological action potential.</p><p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">A single neuron helps us understand membrane dynamics and spike generation. However, neurological phenomena such as epileptic seizures emerge from interactions among populations of neurons. Continue to the Neural Network Lab to explore interactions between excitatory and inhibitory populations.</p><a href="#network-lab" className="mt-4 inline-block text-sm font-semibold text-mint underline">Continue to Level 2: Neural Network Lab &rarr;</a><div className="mt-6"><ProgressionStrip /></div><dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Learn","Membrane dynamics and spike generation"],["Experiment","Manipulate neuronal parameters"],["Observe","Membrane potential and spike timing"],["Explain","How parameters affect neuronal behavior"],["Research","Why epilepsy requires network models"]].map(([term,description])=><div key={term} className="border-l border-line pl-3"><dt className="label">{term}</dt><dd className="mt-2 text-xs leading-relaxed text-muted">{description}</dd></div>)}</dl><div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]"><form noValidate className="card p-5" onSubmit={e => { e.preventDefault(); void submit(e.currentTarget); }}><h3 className="font-semibold">Parameters</h3><fieldset disabled={loading} className="disabled:opacity-60"><legend className="sr-only">Single neuron parameters</legend><div className="mt-5 space-y-4">{fields.map(({key,label,unit,step,min,max})=><label key={key} className="block text-sm text-muted"><span className="mb-1 flex justify-between"><span>{label}</span><span>{unit}</span></span><input aria-label={label} id={"neuron-" + key} aria-invalid={Boolean(validation[key])} aria-describedby={validation[key] ? "neuron-" + key + "-error" : undefined} required type="number" min={min} max={max} step={step} value={values[key]} onChange={e=>controller.edit(key,e.target.value)} className="w-full rounded-md border border-line bg-ink px-3 py-2 text-white" />{validation[key] && <span id={"neuron-" + key + "-error"} className="mt-2 block text-xs text-rose-300">{validation[key]}</span>}</label>)}</div></fieldset>{Object.values(validation).some(Boolean) && <p role="alert" className="mt-3 text-sm text-rose-300">Check the highlighted parameters before running.</p>}<button type="submit" disabled={loading} className="mt-6 w-full rounded-md bg-mint px-4 py-3 font-bold text-ink disabled:opacity-60">{loading?"Simulating…":"Run simulation"}</button><p className="mt-4 text-xs leading-relaxed text-muted">Fixed step: 0.1 ms. Seed is recorded; this deterministic model does not use randomness.</p></form><div className="space-y-5" aria-busy={loading}><p role="status" className="text-sm text-muted">{loading ? "Running the neuron model..." : changed ? "Parameters changed. Results show the last completed run." : result ? "Showing the completed simulation." : "Run simulation to load the neuron model."}</p><div className="card p-5"><div className="flex justify-between"><h3 className="font-semibold">Membrane potential</h3><span className="label">Simulated</span></div>{result?<Chart yTitle="Voltage (mV)" data={[{x:result.time_ms,y:result.voltage_mv,type:"scatter",mode:"lines",line:{color:"#91e6cb",width:2}}]} />:<p className="py-20 text-center text-muted">{loading?"Running model…":"Start the backend to view the voltage trace."}</p>}</div><div className="card p-5"><h3 className="font-semibold">Spike events</h3>{result?<Chart yTitle="Neuron" data={[{x:result.spike_times_ms,y:result.spike_times_ms.map(()=>1),type:"scatter",mode:"markers",marker:{color:"#e7bb80",size:9,symbol:"line-ns-open"}}]} />:<p className="py-12 text-center text-muted">No result yet.</p>}</div>{result&&<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Spikes",result.statistics.spike_count],["Rate",String(result.statistics.firing_rate_hz)+" Hz"],["Mean ISI",result.statistics.mean_isi_ms===null?"—":String(result.statistics.mean_isi_ms)+" ms"],["ISI CV",result.statistics.cv_isi??"—"]].map(([k,v])=><div className="card p-4" key={k}><p className="text-xs text-muted">{k}</p><p className="mt-2 text-xl font-bold text-mint">{v}</p></div>)}</div>}{error&&<p role="alert" className="rounded border border-rose-700 p-3 text-rose-300">{error}</p>}</div></div></section>;
}
