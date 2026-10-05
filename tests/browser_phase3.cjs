/* Real frontend + backend regression. Requires Playwright and a running production
 * frontend/backend. API interception mirrors Vercel routing; it never fabricates
 * network simulation results. DANDI UI uses explicitly labeled test metadata.
 * NODE_PATH can point to an external Playwright installation; no app dependency.
 */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const frontend = process.env.FRONTEND_URL || "http://127.0.0.1:3030";
const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000";
const scientific = value => { const result = structuredClone(value); delete result.execution_time_ms; return result; };

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const calls = [];
    page.on("pageerror", error => errors.push(error.message));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let first = true;
    await page.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/dandi/search") {
        await route.fulfill({ json: [{ dandiset_id: "test-fixture", title: "Browser test metadata", authors: ["Test author"], species: [], experimental_approach: [], source_url: "https://dandiarchive.org", doi: null, license: [], recording_information: null }] });
        return;
      }
      if (url.pathname === "/api/network/compare" && first) { first = false; await gate; }
      const response = await route.fetch({ url: backend + url.pathname + url.search, timeout: 45000 });
      const body = await response.json();
      calls.push({ path: url.pathname, request: route.request().postDataJSON(), status: response.status(), body });
      await route.fulfill({ response });
    });
    await page.goto(frontend, { waitUntil: "domcontentloaded" });
    await page.locator("#network-lab [aria-busy=true]").waitFor();
    await page.locator("#epilepsy-dynamics [aria-busy=true]").waitFor();
    release();
    await page.locator("#epilepsy-dynamics [aria-busy=false] table").waitFor({ timeout: 45000 });
    await page.waitForFunction(() => document.querySelectorAll("#network-lab .js-plotly-plot").length === 2);
    assert.equal(calls.filter(c => c.path.startsWith("/api/network")).length, 1, "one shared initial request");
    const initial = calls.find(c => c.path === "/api/network/compare").body;
    assert.deepEqual(initial.changes, []);
    const network = page.locator("#network-lab");
    const dynamics = page.locator("#epilepsy-dynamics");
    await network.getByRole("button", { name: "Run network simulation", exact: true }).click();
    await network.locator("[aria-busy=false]").waitFor();
    const manual = calls.filter(c => c.path === "/api/network").at(-1);
    assert.equal(manual.status, 200);
    assert.deepEqual(scientific(initial.reference.network), scientific(manual.body));
    // Re-renders from draft edits and preset selection must not run simulations.
    const before = calls.length;
    await dynamics.getByRole("button", { name: /^Increased excitation/ }).click();
    await dynamics.getByLabel("Experimental Excitatory synaptic weight", { exact: true }).fill("0.8");
    await dynamics.getByRole("button", { name: /^Increased excitation/ }).click();
    assert.equal(calls.length, before);
    assert.match(await dynamics.locator("[role=status]").innerText(), /Parameters changed/);
    await dynamics.getByRole("button", { name: "Run comparison", exact: true }).click();
    await dynamics.locator("[aria-busy=false] table").waitFor();
    const experiment = calls.filter(c => c.path === "/api/network/compare").at(-1).body;
    assert.deepEqual(experiment.changes, [{ parameter: "excitatory_weight_mv", reference: 0.5, experimental: 0.75 }]);
    assert.deepEqual(scientific(experiment.reference.network), scientific(initial.reference.network));
    await page.waitForFunction(() => document.querySelectorAll("#epilepsy-dynamics .js-plotly-plot").length === 5);
    const plots = await dynamics.locator(".js-plotly-plot").evaluateAll(nodes => nodes.map(n => ({
      traces: n.data.map(d => ({ x: Array.from(d.x), y: Array.from(d.y) })),
      xRange: n.layout.xaxis.range, yRange: n.layout.yaxis.range,
    })));
    assert.deepEqual(plots[1].yRange, plots[3].yRange, "matched rate axes");
    assert.deepEqual(plots[0].xRange, plots[2].xRange, "matched raster time axes");
    assert.equal(plots[0].traces.reduce((n, t) => n + t.x.length, 0), initial.reference.network.summary.total_spikes);
    assert.deepEqual(plots[1].traces[0].y, experiment.reference.network.rates.excitatory_hz);
    assert.deepEqual(plots[3].traces[1].y, experiment.experimental.network.rates.inhibitory_hz);
    assert.deepEqual(plots[4].traces[0].y, experiment.reference.coordination.active_fraction);
    assert.deepEqual(plots[4].traces[1].y, experiment.experimental.coordination.active_fraction);
    assert.deepEqual(plots[4].yRange, [0, 1]);
    assert.equal(await dynamics.locator("tbody tr").count(), 6);
    // Existing single-neuron interaction and synthetic demo still render.
    await page.locator("#neuron-lab").getByRole("button", { name: "Run simulation", exact: true }).click();
    await page.locator("#neuron-lab").getByRole("button", { name: "Run simulation", exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll("#neuron-lab .js-plotly-plot").length === 2);
    await page.locator("#real-data").getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("heading", { name: "Browser test metadata" }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll("#real-data .js-plotly-plot").length === 1);
    // Preserve Phase 2 safety and silent-network behavior.
    await network.locator("#network-neuron_count").fill("200");
    await network.locator("#network-duration_ms").fill("1000");
    assert.equal(await network.getByRole("button", { name: "Run network simulation" }).isDisabled(), true);
    await network.locator("#network-neuron_count").fill("100");
    await network.locator("#network-duration_ms").fill("500");
    await network.locator("#network-external_drive_mv").fill("0");
    await network.getByRole("button", { name: "Run network simulation" }).click();
    await network.getByText("No spikes occurred in this run.", { exact: false }).waitFor();
    assert.equal(calls.filter(c => c.path === "/api/network").at(-1).body.summary.total_spikes, 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await dynamics.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.documentElement.scrollWidth <= window.innerWidth);
    if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH, fullPage: true });
    assert.deepEqual(errors, []);
    assert(calls.every(c => c.status === 200));
    // Recover independently after an initial busy response.
    const retry = await browser.newPage();
    let failOnce = true;
    await retry.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/network/compare" && failOnce) {
        failOnce = false;
        await route.fulfill({ status: 503, json: { detail: "Simulator busy; retry shortly." } });
        return;
      }
      const response = await route.fetch({ url: backend + url.pathname + url.search });
      await route.fulfill({ response });
    });
    await retry.goto(frontend);
    await retry.locator("#network-lab [role=alert]").waitFor();
    await retry.locator("#epilepsy-dynamics [role=alert]").waitFor();
    await retry.locator("#network-lab").getByRole("button", { name: "Run network simulation" }).click();
    await retry.locator("#network-lab [data-testid=network-results]").waitFor();
    await retry.locator("#epilepsy-dynamics").getByRole("button", { name: "Run comparison", exact: true }).click();
    await retry.locator("#epilepsy-dynamics table").waitFor();
    assert.equal(await retry.locator("#network-lab [role=alert], #epilepsy-dynamics [role=alert]").count(), 0);
    console.log("PASS: baseline loading/deduplication/manual equivalence, preset comparison, exact plotted data, matched axes, metrics, stale drafts, Phase 1, Phase 2 bounds/silence, DANDI fixture UI, mobile layout, busy recovery; no page errors.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
