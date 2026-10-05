"use client";

import { useEffect, useSyncExternalStore } from "react";
import NeuronLab, { initial, loadNeuronBaseline, runNeuron } from "./NeuronLab";
import NetworkLab from "./NetworkLab";
import DynamicsLab, { reference } from "./DynamicsLab";
import { defaults, loadBaseline, runComparison, runNetwork, type Experiment, type Comparison } from "./network-client";
import { useLabSession } from "./useLabSession";

type LabId = "single-neuron" | "network-lab" | "epilepsy-dynamics";
const labs: { id: LabId; level: string; name: string; description: string }[] = [
  { id: "single-neuron", level: "01", name: "Single Neuron", description: "Start with membrane potential and spikes." },
  { id: "network-lab", level: "02", name: "Neural Network", description: "Explore interacting excitatory and inhibitory neurons." },
  { id: "epilepsy-dynamics", level: "03", name: "Epilepsy Dynamics", description: "Compare simulated network states." },
];
function resolveHash(hash: string): LabId | null {
  if (hash === "" || hash === "#neuron-lab" || hash === "#single-neuron") return "single-neuron";
  return labs.find(lab => "#" + lab.id === hash)?.id ?? null;
}
// Non-lab anchors (About, Real Data) keep the current workspace selected.
let lastLab: LabId = "single-neuron";
function snapshot() { return resolveHash(window.location.hash) ?? lastLab; }
function subscribe(onChange: () => void) {
  const sync = () => {
    lastLab = resolveHash(window.location.hash) ?? lastLab;
    onChange();
  };
  sync();
  window.addEventListener("hashchange", sync);
  window.addEventListener("popstate", sync);
  return () => {
    window.removeEventListener("hashchange", sync);
    window.removeEventListener("popstate", sync);
  };
}
const serverSnapshot = () => null;
const loadNetworkBaseline = () => loadBaseline().then(data => data.reference.network);

export default function LabWorkspace() {
  // Server/hydration initially render the selector only. Resolve deep links before
  // mounting any lab, so a direct network link never starts a neuron simulation.
  const active = useSyncExternalStore<LabId | null>(subscribe, snapshot, serverSnapshot);
  const neuron = useLabSession(initial, loadNeuronBaseline, runNeuron);
  const network = useLabSession(defaults, loadNetworkBaseline, runNetwork);
  const dynamics = useLabSession<Experiment, Comparison>(reference, loadBaseline, runComparison);
  useEffect(() => {
    if (!active || !window.location.hash || !resolveHash(window.location.hash)) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("explore-labs")?.scrollIntoView({ block: "start" });
      const selected = document.querySelector<HTMLElement>('#explore-labs [aria-current="page"]');
      const selector = selected?.parentElement;
      if (selected && selector && selector.scrollWidth > selector.clientWidth) {
        selector.scrollLeft += selected.getBoundingClientRect().left - selector.getBoundingClientRect().left;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return <section id="explore-labs" className="scroll-mt-32" aria-labelledby="explore-labs-title">
    <div className="mx-auto max-w-7xl px-6 pt-16">
      <p className="label">Choose your workspace</p>
      <h2 id="explore-labs-title" className="section-title mt-3">Explore NeuroSim Lab</h2>
      <p className="mt-3 max-w-3xl text-muted">Select a lab to begin. Start with Single Neuron, then explore networks and compare their dynamics. Your drafts and results stay available when you switch labs on this page.</p>
      <p className="mt-4 text-sm text-mint lg:hidden">Swipe or scroll to explore labs &rarr;</p>
      <nav aria-label="Lab selector" className="mt-4 flex snap-x gap-4 overflow-x-auto pb-4 pt-1 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {labs.map(lab => <a key={lab.id} href={"#" + lab.id} aria-current={active === lab.id ? "page" : undefined}
          className={"min-w-[min(75vw,260px)] flex-1 snap-start cursor-pointer rounded-xl border-2 p-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint lg:min-w-0 " + (active === lab.id ? "border-mint bg-mint/10" : "border-line bg-[#111b27] hover:border-mint/70 hover:bg-mint/5")}>
          <span className="flex items-center justify-between gap-3"><span className="text-2xl font-bold text-mint">{lab.level}</span><span className="text-[10px] font-bold tracking-wider text-mint">IMPLEMENTED</span></span>
          <span className="mt-3 block text-lg font-bold">{lab.name}</span>
          <span className="mt-2 block text-sm text-muted">{lab.description}</span>
          <span className="mt-4 block text-sm font-bold text-mint">{active === lab.id ? "Selected workspace" : "Open lab"} &rarr;</span>
        </a>)}
        <button type="button" disabled className="min-w-[min(75vw,260px)] flex-1 snap-start cursor-not-allowed rounded-xl border-2 border-dashed border-line p-5 text-left lg:min-w-0" aria-label="Level 4 Real EEG, next development stage, not available yet">
          <span className="flex items-center justify-between"><span className="text-2xl font-bold text-muted">04</span><span className="text-[10px] font-bold tracking-wider text-amber-200">NEXT</span></span>
          <span className="mt-3 block text-lg font-bold text-muted">Real EEG</span>
          <span className="mt-2 block text-sm text-muted">Real epilepsy electrophysiology.</span>
          <span className="mt-4 block text-sm text-muted">Not available yet</span>
        </button>
      </nav>
    </div>
    <div data-testid="active-lab" data-lab={active ?? "loading"}>
      {!active && <p role="status" className="mx-auto max-w-7xl px-6 py-10 text-muted">Opening laboratory...</p>}
      {active === "single-neuron" && <div id="single-neuron" className="scroll-mt-32"><NeuronLab controller={neuron} /></div>}
      {active === "network-lab" && <NetworkLab controller={network} />}
      {active === "epilepsy-dynamics" && <DynamicsLab controller={dynamics} />}
    </div>
  </section>;
}
