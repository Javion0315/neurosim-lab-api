import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "NeuroSim Lab | Computational Neuroscience Playground", description: "Explore neural data metadata, spike trains, and a reproducible neuron model." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
