import Link from "next/link";

export type RoadmapLevel = {
  level: number;
  title: string;
  status: string;
  learn?: string;
  model?: string;
  purpose?: string;
  signals?: string[];
  connection?: string;
};

export const roadmapLevels: RoadmapLevel[] = [
  {
    level: 1,
    title: "Single Neuron",
    status: "Implemented",
    learn: "Membrane potential, threshold, spike generation, and refractory period.",
    model: "Leaky integrate-and-fire (LIF).",
    connection: "Why is one neuron insufficient to explain epilepsy?",
  },
  {
    level: 2,
    title: "Neural Network",
    status: "Next Development Stage",
    learn: "Synapses, connectivity, excitation, inhibition, and E/I balance.",
    model: "Planned: LIF network initially, with possible future AdEx or Izhikevich models.",
    connection: "How can interactions among neurons produce population-level dynamics?",
  },
  {
    level: 3,
    title: "Epilepsy Dynamics",
    status: "Planned",
    learn: "Network excitability, synchronization, bursting, and seizure-like transitions.",
    connection: "How can a stable network transition toward pathological synchronization?",
  },
  {
    level: 4,
    title: "Real EEG",
    status: "Planned",
    learn: "Interictal, pre-ictal, ictal, and post-ictal states. Future data sources may include public epilepsy EEG datasets.",
    connection: "Can measurable changes in real EEG be compared with simulated network dynamics?",
  },
  {
    level: 5,
    title: "Seizure Forecasting",
    status: "Planned",
    learn: "Feature extraction, time-series analysis, machine learning, and uncertainty.",
    connection: "Can patient-specific signals identify increasing seizure risk before onset?",
  },
  {
    level: 6,
    title: "Wearable Signals",
    status: "Future",
    signals: ["HR / HRV", "EDA", "PPG", "movement", "sleep", "temperature", "respiration"],
    connection: "Can peripheral physiological signals complement EEG for seizure forecasting?",
  },
  {
    level: 7,
    title: "Neuromodulation",
    status: "Future",
    purpose: "Explore how hypothetical changes in network parameters influence stability. This is a modeling objective, not a clinical treatment claim.",
  },
  {
    level: 8,
    title: "Olfactory Neuromodulation",
    status: "Research Vision",
    purpose: "Investigate whether controlled olfactory stimuli or defined volatile molecular constituents can produce measurable and reproducible neural modulation. No efficacy is claimed.",
  },
  {
    level: 9,
    title: "Personalized Digital Twin",
    status: "Long-term Vision",
    purpose: "Explore patient-specific computational models that could eventually integrate inputs such as MRI, diffusion MRI, EEG, and physiological signals. This remains a future research concept.",
  },
];

const statusTone: Record<string, string> = {
  Implemented: "border-mint/50 bg-mint/10 text-mint",
  "Next Development Stage": "border-amber-300/40 bg-amber-300/10 text-amber-200",
};

export function ProgressionStrip() {
  return (
    <ol aria-label="Learning progression" className="flex flex-wrap items-center gap-2">
      {roadmapLevels.slice(0, 6).map((item, index) => (
        <li key={item.level} className="flex items-center gap-2">
          <span className={item.level === 1 ? "rounded border border-mint/50 bg-mint/10 px-3 py-2 text-xs font-semibold text-mint" : "rounded border border-line px-3 py-2 text-xs text-muted"}>
            {item.title}
          </span>
          {index < 5 && <span aria-hidden="true" className="text-line">-&gt;</span>}
        </li>
      ))}
    </ol>
  );
}

export default function ResearchRoadmap({ compact = false }: { compact?: boolean }) {
  const levels = compact ? roadmapLevels.slice(0, 3) : roadmapLevels;
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {levels.map((item) => (
          <article key={item.level} className="card relative overflow-hidden p-6">
            <div className="absolute left-0 top-0 h-full w-1 bg-line" aria-hidden="true" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="label">Level {item.level}</p>
              <span className={"rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide " + (statusTone[item.status] || "border-line bg-ink/50 text-muted")}>
                {item.status}
              </span>
            </div>
            <h3 className="mt-4 text-xl font-bold">{item.title}</h3>
            {item.learn && <p className="mt-4 text-sm leading-relaxed text-muted"><strong className="text-slate-200">Learn:</strong> {item.learn}</p>}
            {item.model && <p className="mt-3 text-sm leading-relaxed text-muted"><strong className="text-slate-200">Model:</strong> {item.model}</p>}
            {item.purpose && <p className="mt-4 text-sm leading-relaxed text-muted"><strong className="text-slate-200">Purpose:</strong> {item.purpose}</p>}
            {item.signals && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-200">Potential signals</p>
                <ul className="mt-2 flex flex-wrap gap-2">{item.signals.map((signal) => <li key={signal} className="rounded border border-line px-2 py-1 text-xs text-muted">{signal}</li>)}</ul>
              </div>
            )}
            {item.connection && <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-muted"><strong className="text-mint">Research connection:</strong> {item.connection}</p>}
          </article>
        ))}
      </div>
      {compact && <Link href="/research-vision#roadmap" className="mt-6 inline-block text-sm font-semibold text-mint underline">View the complete learning and research roadmap -&gt;</Link>}
    </div>
  );
}