/* Production UI against the real EEG backend; never fabricates EEG samples. */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const frontend = process.env.FRONTEND_URL || "http://127.0.0.1:3030";
const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const calls = [], errors = [];
    let fail = false;
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/api/**", async route => {
      const u = new URL(route.request().url());
      calls.push({ path: u.pathname, body: route.request().postDataJSON() });
      if (fail && u.pathname.includes("/eeg/")) {
        await route.fulfill({ status: 503, json: { detail: "Real EEG artifact unavailable. No synthetic replacement is provided." } });
        return;
      }
      const response = await route.fetch({ url: backend + u.pathname + u.search, timeout: 45000 });
      await route.fulfill({ response });
    });
    await page.goto(frontend + "#real-eeg");
    const lab = page.locator("#real-eeg");
    const load = lab.getByRole("button", { name: "Load EEG", exact: true });
    await load.waitFor();
    await page.waitForFunction(() => document.querySelectorAll("#real-eeg .js-plotly-plot").length === 2);
    assert.equal(calls.length, 1, "only the EEG initialization request");
    assert(calls[0].path.includes("/eeg/"));
    assert.equal(await page.locator("#neuron-lab, #network-lab, #epilepsy-dynamics").count(), 0);
    const annotation = await lab.locator(".js-plotly-plot").first().evaluate(n => ({ shapes: n.layout.shapes, x: n.layout.xaxis.title.text, y: n.layout.yaxis.title.text, count: n.data[0].x.length }));
    assert.equal(annotation.shapes[0].x0, 2996);
    assert.equal(annotation.shapes[0].x1, 3006);
    assert.equal(annotation.x, "Time (s)");
    assert.equal(await lab.locator(".js-plotly-plot").first().evaluate(n => n.layout.xaxis.position), 0);
    assert(annotation.y.includes("uV"));
    assert.equal(annotation.count, 5120);
    await lab.getByRole("heading", { name: "Data Provenance" }).waitFor();
    await lab.locator("#eeg-start_s").fill("");
    await load.click();
    assert.equal(await lab.locator("#eeg-start_s").inputValue(), "");
    assert.equal(calls.length, 1, "invalid draft never reaches API");
    await lab.getByRole("button", { name: "Before annotated seizure", exact: true }).click();
    await lab.getByRole("checkbox", { name: "F7-T7", exact: true }).check();
    await lab.getByRole("checkbox", { name: "T7-P7", exact: true }).check();
    assert.equal(await lab.getByRole("checkbox", { name: "P7-O1", exact: true }).isDisabled(), true);
    await load.click(); await load.waitFor();
    assert.equal(calls.length, 2);
    await page.waitForFunction(() => document.querySelector("#real-eeg .js-plotly-plot").data.length === 4);
    assert.equal(await lab.locator(".js-plotly-plot").first().evaluate(n => n.layout.shapes.length), 0);
    await lab.getByRole("combobox", { name: "EEG view" }).selectOption("compare");
    await load.click(); await load.waitFor();
    await page.waitForFunction(() => document.querySelectorAll("#real-eeg .js-plotly-plot").length === 4);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls.at(-1).body.windows, [{ start_s: 2976, end_s: 2996 }, { start_s: 3006, end_s: 3026 }]);
    assert.equal(await lab.locator("tbody tr").count(), 8);
    const ranges = await lab.locator(".js-plotly-plot").evaluateAll(nodes => [nodes[0].layout.yaxis.range, nodes[2].layout.yaxis.range]);
    assert.deepEqual(ranges[0], ranges[1]);
    await lab.locator("#eeg-comparison_end_s").fill("3027");
    await load.click();
    assert.equal(calls.length, 3);
    await lab.locator("#eeg-comparison_end_s").fill("3026");
    const nav = page.getByRole("navigation", { name: "Lab selector" });
    await nav.getByRole("link", { name: /Single Neuron/ }).click();
    await page.locator("#neuron-lab [aria-busy=false]").waitFor();
    await nav.getByRole("link", { name: /Real EEG/ }).click();
    await lab.locator("[data-testid=eeg-results]").waitFor();
    assert.equal(await lab.locator("#eeg-start_s").inputValue(), "2976");
    assert.equal(calls.filter(c => c.path.includes("/eeg/")).length, 3);
    await page.goBack(); await page.locator("#neuron-lab").waitFor();
    await page.goForward(); await lab.waitFor();
    assert.equal(await page.locator("#neuron-lab, #network-lab, #epilepsy-dynamics, #real-eeg").count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    await page.waitForFunction(() => [...document.querySelectorAll("#real-eeg .js-plotly-plot")].every(n => n._fullLayout.width <= n.clientWidth + 2));
    assert.equal(await nav.getByRole("button", { name: /Seizure Forecasting/ }).isDisabled(), true);
    if (process.env.SCREENSHOT_PATH) {
      await lab.getByRole("heading", { name: "Window A: 2976-2996 s", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: process.env.SCREENSHOT_PATH });
    }
    fail = true;
    await load.click(); await lab.getByRole("alert").waitFor();
    assert((await lab.getByRole("alert").innerText()).includes("No synthetic"));
    fail = false;
    await load.click(); await load.waitFor();
    assert.equal(await lab.getByRole("alert").count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS Phase 4: real-data deep link, one request/no inactive simulations, stacked channels, amplitude/time axes, annotation, PSD, features, numeric validation, comparison, state/history, mobile layout, explicit failure/retry.");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
