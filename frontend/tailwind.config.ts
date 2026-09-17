import type { Config } from "tailwindcss";
export default { content: ["./app/**/*.{ts,tsx}"], theme: { extend: { colors: { ink: "#0b111a", panel: "#111b27", line: "#263848", mint: "#91e6cb", muted: "#9aaebd" } } }, plugins: [] } satisfies Config;
