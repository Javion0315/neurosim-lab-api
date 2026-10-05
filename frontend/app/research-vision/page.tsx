import Link from "next/link";
import ResearchRoadmap from "../../components/ResearchRoadmap";

const pathwayA = [
  "Olfactory stimulus / molecular constituents",
  "Olfactory system",
  "Piriform and limbic networks",
  "Neural excitability and synchronization",
  "Seizure susceptibility",
];
const pathwayB = [
  "EEG + wearable physiological signals",
  "Machine learning",
  "Personalized state estimation",
  "Closed-loop neuromodulation research",
];

function Pathway({ steps }: { steps: string[] }) {
  return <ol className="grid gap-3">{steps.map((step, index) => <li key={step} className="flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-mint/40 bg-mint/10 text-xs font-bold text-mint">{index + 1}</span><span className="card flex-1 px-4 py-3 text-sm text-slate-200">{step}</span></li>)}</ol>;
}

export default function ResearchVisionPage() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
          <Link href="/" className="mr-auto text-lg font-bold text-mint">NeuroSim Lab</Link>
          <Link href="/#real-data" className="text-sm text-muted hover:text-white">Real Data</Link>
          <Link href="/#neuron-lab" className="text-sm text-muted hover:text-white">Neuron Lab</Link>
          <Link href="/#network-lab" className="text-sm text-muted hover:text-white">Network Lab</Link>
          <Link href="/research-vision" aria-current="page" className="text-sm font-semibold text-white">Research Vision</Link>
          <Link href="/#about" className="text-sm text-muted hover:text-white">About</Link>
        </nav>
      </header>
      <main>
        <section className="grid-bg border-b border-line">
          <div className="mx-auto max-w-5xl px-6 py-20 lg:py-28">
            <p className="label">Learning direction / research hypothesis</p>
            <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl">Research Vision</h1>
            <p className="mt-8 max-w-4xl text-2xl font-medium leading-relaxed text-slate-100">Can specific olfactory stimuli modulate neural network dynamics associated with seizure susceptibility, and can these responses eventually be predicted and personalized using computational models?</p>
            <div className="mt-10 rounded-xl border border-amber-300/40 bg-amber-300/10 p-5 text-sm leading-relaxed text-amber-100">
              <strong>Scientific scope:</strong> This platform explores computational hypotheses and research methods. Simulations are not evidence of clinical efficacy and are not intended for diagnosis or treatment.
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20">
          <p className="label">Scientific progression</p>
          <h2 className="section-title mt-3">From measurable mechanisms to a testable research program</h2>
          <p className="mt-3 max-w-3xl text-muted">The pathway organizes questions and measurements. It does not assert that olfactory stimulation prevents or treats epilepsy.</p>
          <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <Pathway steps={pathwayA} />
            <div className="text-center text-2xl text-mint" aria-hidden="true">+</div>
            <Pathway steps={pathwayB} />
          </div>
        </section>

        <section className="border-y border-line bg-[#0e1721]">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <p className="label">Evidence boundaries</p>
            <h2 className="section-title mt-3">What is measured, hypothesized, and envisioned</h2>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              <article className="card p-6"><p className="label">Established / measurable</p><ul className="mt-5 space-y-2 text-sm text-muted">{["Neuronal electrical activity","Excitation / inhibition balance","Neural synchronization","EEG","Physiological signals","Computational neural models"].map(x=><li key={x}>- {x}</li>)}</ul></article>
              <article className="card p-6"><p className="label">Research hypotheses</p><ul className="mt-5 space-y-3 text-sm leading-relaxed text-muted"><li>- Whether specific olfactory stimuli can reliably modulate seizure-relevant neural dynamics.</li><li>- Whether those effects can be predicted computationally.</li><li>- Whether effects are reproducible enough to study personalized intervention.</li></ul></article>
              <article className="card p-6"><p className="label">Long-term vision</p><ul className="mt-5 space-y-3 text-sm leading-relaxed text-muted"><li>- Patient-specific computational brain models.</li><li>- Multimodal wearable seizure forecasting.</li><li>- Closed-loop olfactory neuromodulation research.</li></ul></article>
            </div>
          </div>
        </section>

        <section id="roadmap" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20">
          <p className="label">Nine levels</p>
          <h2 className="section-title mt-3">Learning + Research Roadmap</h2>
          <p className="mt-3 mb-9 max-w-3xl text-muted">Each level adds a scientific concept and a research question. Levels 1, 2, and 3 are implemented as interactive models. Level 4, Real EEG, is the next development stage.</p>
          <ResearchRoadmap />
        </section>
      </main>
      <footer className="border-t border-line px-6 py-6 text-center text-xs text-muted">NeuroSim Lab · Computational hypotheses · No clinical claims</footer>
    </>
  );
}