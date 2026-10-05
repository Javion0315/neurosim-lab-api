"use client";
import { useEffect, useRef, useState } from "react";
import type { Data, Layout } from "plotly.js";
import type { EEGResult, EEGWindow } from "./eeg-client";

export default function EEGPlot({ window: signalWindow, result, spectrum = false }: { window: EEGWindow; result: EEGResult; spectrum?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;
    const node = ref.current;
    const colors = ["#72e2be", "#83b9ff", "#e3bf83", "#dca5ed"];
    const channels = signalWindow.channels;
    let amplitude = 1, spectralMax = 0.001;
    for (const w of result.windows) for (const c of w.channels) {
      for (const v of c.voltage_uv) amplitude = Math.max(amplitude, Math.abs(v));
      for (const v of c.psd.density_uv2_per_hz) spectralMax = Math.max(spectralMax, v);
    }
    const data: Data[] = channels.map((c, i) => ({
      type: "scatter", mode: "lines", name: c.name,
      x: spectrum ? c.psd.frequency_hz : signalWindow.time_s,
      y: spectrum ? c.psd.density_uv2_per_hz : c.voltage_uv,
      yaxis: spectrum || i === 0 ? "y" : "y" + (i + 1),
      line: { color: colors[i], width: 1 },
    }));
    const layout: Partial<Layout> = {
      paper_bgcolor: "#111b27", plot_bgcolor: "#111b27", font: { color: "#9aaebd", size: 11 },
      margin: { l: 85, r: 15, t: 30, b: spectrum ? 85 : 45 },
      xaxis: { anchor: "free", position: 0, title: { text: spectrum ? "Frequency (Hz)" : "Time (s)" }, gridcolor: "#263848", range: spectrum ? [0, result.provenance.sampling_hz / 2] : [signalWindow.start_s, signalWindow.end_s] },
      showlegend: spectrum, legend: { orientation: "h", y: -0.25 },
    };
    if (spectrum) layout.yaxis = { title: { text: "PSD (uV^2/Hz)" }, range: [0, spectralMax * 1.05], gridcolor: "#263848" };
    else {
      channels.forEach((c, i) => {
        Object.assign(layout, { [i === 0 ? "yaxis" : "yaxis" + (i + 1)]: {
          title: { text: c.name + "<br>uV" }, range: [-amplitude * 1.05, amplitude * 1.05],
          domain: [1 - (i + 1) / channels.length + 0.035, 1 - i / channels.length - 0.025],
          gridcolor: "#263848", zerolinecolor: "#435265",
        } });
      });
      const annotation = result.provenance.annotation;
      const a = Math.max(annotation.start_s, signalWindow.start_s), b = Math.min(annotation.end_s, signalWindow.end_s);
      layout.shapes = a < b ? [{ type: "rect", xref: "x", yref: "paper", x0: a, x1: b, y0: 0, y1: 1, fillcolor: "rgba(227,191,131,0.14)", line: { width: 0 }, layer: "below" }] : [];
      layout.annotations = a < b ? [{ xref: "paper", yref: "paper", x: 0.5, y: 1.07, text: "Dataset annotation (shaded)", showarrow: false }] : [];
    }
    import("plotly.js-basic-dist-min").then(async mod => {
      if (!active || !node) return;
      let observer: ResizeObserver | undefined;
      cleanup = () => { observer?.disconnect(); mod.purge(node); };
      await mod.newPlot(node, data, layout, { responsive: true, displayModeBar: false });
      if (active) {
        observer = new ResizeObserver(() => { if (active) void mod.Plots.resize(node); });
        observer.observe(node);
        setFailed(false);
      }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; cleanup?.(); };
  }, [signalWindow, result, spectrum]);
  return <>{failed && <p role="alert">EEG plot unavailable. Reload to retry.</p>}<div ref={ref} role="img" aria-label={spectrum ? "Welch power spectral density in microvolts squared per hertz" : "Stacked EEG voltage in microvolts versus time in seconds; dataset annotation shaded"} style={{ width: "100%", height: spectrum ? 330 : Math.max(310, signalWindow.channels.length * 145) }} /></>;
}
