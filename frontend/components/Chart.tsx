"use client";

import { useEffect, useRef, useState } from "react";
import type { Data, Layout } from "plotly.js";

type Props = {
  data: Data[];
  yTitle: string;
  showLegend?: boolean;
  xRange?: [number, number];
  yRange?: [number, number];
};

export default function Chart({ data, yTitle, showLegend = false, xRange, yRange }: Props) {
  const chart = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const node = chart.current;
    let active = true;
    let cleanup: (() => void) | undefined;
    const layout: Partial<Layout> = {
      paper_bgcolor: "#111b27", plot_bgcolor: "#111b27",
      font: { color: "#9aaebd", size: 12 },
      margin: { l: 55, r: 12, t: 12, b: showLegend ? 75 : 45 },
      xaxis: { title: { text: "Time (ms)" }, gridcolor: "#263848", range: xRange },
      yaxis: { title: { text: yTitle }, gridcolor: "#263848", range: yRange },
      showlegend: showLegend, legend: { orientation: "h", y: -0.25 },
    };
    import("plotly.js-basic-dist-min").then(async (mod) => {
      if (!active || !node) return;
      cleanup = () => mod.purge(node);
      await mod.newPlot(node, data, layout, { displayModeBar: false, responsive: true });
      if (active) setError(false);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; cleanup?.(); };
  }, [data, yTitle, showLegend, xRange, yRange]);
  return <>{error && <p role="alert" className="text-sm text-rose-300">The plot could not load. Reload the page to retry.</p>}<div ref={chart} role="img" aria-label={`${yTitle} versus time in milliseconds`} style={{ width: "100%", height: showLegend ? "320px" : "280px" }} /></>;
}
