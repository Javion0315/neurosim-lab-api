/* Phase 3.1 production-browser regression; same external Playwright setup as
 * browser_phase3.cjs. All simulation responses come from the real backend.
 */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const frontend = process.env.FRONTEND_URL || "http://127.0.0.1:3030";
const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000";
const scientific = r => { const v = structuredClone(r); delete v.execution_time_ms; return v; };
const simulationCount = calls => calls.filter(c => c.path === "/api/lif" || c.path.startsWith("/api/network")).length;

async function connect(page, calls, paused) {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const call = { path: url.pathname, parameters: route.request().postDataJSON() };
    calls.push(call);
    if (paused && paused.path === url.pathname) {
      paused.path = "";
      await paused.promise;
    }
    const response = await route.fetch({ url: backend + url.pathname + url.search, timeout: 45000 });
    call.status = response.status();
    call.body = await response.json();
    await route.fulfill({ response });
  });
}
async function choose(page, name, id) {
  await page.getByRole("navigation", { name: "Lab selector" }).getByRole("link", { name }).click();
  await page.locator('[data-testid="active-lab"][data-lab="' + id + '"]').waitFor();
  assert.equal(await page.locator("#neuron-lab, #network-lab, #epilepsy-dynamics").count(), 1, "only one lab tree mounted");
}
async function auditEmptyFields(scope) {
  const fields = scope.locator('input[type="number"]');
  const count = await fields.count();
  for (let i = 0; i < count; i++) {
    const input = fields.nth(i);
    const before = await input.inputValue();
    await input.focus();
    await input.press("ControlOrMeta+A");
    await input.press("Backspace");
    assert.equal(await input.inputValue(), "", "clearing field does not insert zero");
    await input.press("Tab");
    assert.equal(await input.inputValue(), "", "blur does not silently restore a value");
    await input.fill(before);
  }
  return count;
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], calls = [];
    page.on("pageerror", error => errors.push(error.message));
    let release;
    const paused = { path: "/api/network/compare", promise: new Promise(resolve => { release = resolve; }) };
    await connect(page, calls, paused);
    await page.goto(frontend);
    const neuron = page.locator("#neuron-lab");
    await neuron.locator("[aria-busy=false]").waitFor();
    assert.equal(await page.locator("#network-lab, #epilepsy-dynamics").count(), 0);
    assert.equal(calls.filter(c => c.path === "/api/lif").length, 1);
    assert.equal(calls.filter(c => c.path.startsWith("/api/network") || c.path === "/api/demo").length, 0, "no inactive simulation work");
    let audited = await auditEmptyFields(neuron);
    const drive = neuron.locator("#neuron-input_drive_mv");
    await drive.focus(); await drive.press("ControlOrMeta+A"); await drive.press("Delete");
    assert.equal(await drive.inputValue(), "");
    const beforeInvalid = simulationCount(calls);
    await neuron.getByRole("button", { name: "Run simulation", exact: true }).click();
    await neuron.locator("#neuron-input_drive_mv-error").waitFor();
    assert.equal(simulationCount(calls), beforeInvalid);
    assert.equal(await drive.evaluate(n => n === document.activeElement), true, "invalid field gets focus");
    await drive.pressSequentially("4");
    assert.equal(await drive.inputValue(), "4");
    await drive.press("ArrowUp"); assert.equal(await drive.inputValue(), "5");
    await drive.press("ArrowDown"); assert.equal(await drive.inputValue(), "4");
    await drive.press("Tab");
    assert.equal(await neuron.locator("#neuron-tau_m_ms").evaluate(n => n === document.activeElement), true);
    const rest = neuron.locator("#neuron-v_rest_mv");
    await rest.fill(""); await rest.pressSequentially("-");
    assert.notEqual(await rest.inputValue(), "0");
    await rest.pressSequentially("65");
    assert.equal(await rest.inputValue(), "-65", "negative entry survives intermediate minus sign");
    await drive.press("Enter");
    await neuron.locator("[aria-busy=false]").waitFor();
    assert.equal(calls.filter(c => c.path === "/api/lif").at(-1).parameters.input_drive_mv, 4);
    for (const [key, invalid, valid] of [
      ["seed", "1.5", "42"], ["tau_m_ms", "0", "20"], ["v_threshold_mv", "-70", "-50"],
    ]) {
      const before = simulationCount(calls);
      await neuron.locator("#neuron-" + key).fill(invalid);
      await neuron.getByRole("button", { name: "Run simulation", exact: true }).click();
      await neuron.locator('[aria-invalid="true"]').first().waitFor();
      assert.equal(simulationCount(calls), before);
      await neuron.locator("#neuron-" + key).fill(valid);
    }
    await drive.fill(""); // Preserve an unfinished draft when switching away.
    // Keyboard selection while the network baseline is deliberately held.
    const networkLink = page.getByRole("navigation", { name: "Lab selector" }).getByRole("link", { name: /Neural Network/ });
    await networkLink.focus(); await page.keyboard.press("Enter");
    await page.locator("#network-lab [aria-busy=true]").waitFor();
    await page.goBack();
    await page.locator('[data-testid=active-lab][data-lab=single-neuron]').waitFor();
    assert.equal(new URL(page.url()).hash, "", "Back restores the original hashless default");
    assert.equal(await drive.inputValue(), "");
    release();
    await page.goForward();
    await page.locator('[data-testid=active-lab][data-lab=network-lab]').waitFor();
    const network = page.locator("#network-lab");
    await network.locator("[aria-busy=false]").waitFor();
    assert.equal(calls.filter(c => c.path === "/api/network/compare").length, 1, "switching during baseline does not duplicate it");
    const baseline = calls.find(c => c.path === "/api/network/compare").body;
    await network.getByRole("button", { name: "Run network simulation" }).click();
    await network.locator("[aria-busy=false]").waitFor();
    assert.deepEqual(scientific(baseline.reference.network), scientific(calls.filter(c => c.path === "/api/network").at(-1).body));
    audited += await auditEmptyFields(network);
    const weight = network.locator("#network-excitatory_weight_mv");
    await weight.fill("0.75");
    await weight.press("Enter");
    await network.locator("[aria-busy=false]").waitFor();
    const networkExperiment = calls.filter(c => c.path === "/api/network").at(-1);
    assert.equal(networkExperiment.parameters.excitatory_weight_mv, .75);
    for (const [key, invalid, valid] of [
      ["neuron_count", "100.5", "100"], ["connection_probability", "0.31", "0.1"],
      ["duration_ms", "501", "500"], ["seed", "", "42"],
    ]) {
      const before = simulationCount(calls);
      await network.locator("#network-" + key).fill(invalid);
      await network.getByRole("button", { name: "Run network simulation" }).click();
      await network.locator("#network-" + key + "-error").waitFor();
      assert.equal(simulationCount(calls), before);
      await network.locator("#network-" + key).fill(valid);
    }
    await network.locator("#network-duration_ms").fill("");
    const countBeforePhase3 = simulationCount(calls);
    await choose(page, /Epilepsy Dynamics/, "epilepsy-dynamics");
    const dynamics = page.locator("#epilepsy-dynamics");
    await dynamics.locator("[data-testid=reference-view]").waitFor();
    await page.waitForFunction(() => document.querySelectorAll("#epilepsy-dynamics .js-plotly-plot").length === 3);
    assert.equal(simulationCount(calls), countBeforePhase3, "Phase 3 shares the exact cached initial reference");
    assert.equal(await dynamics.locator("[data-testid=network-results]").count(), 1);
    assert.equal(await dynamics.locator("table").count(), 0);
    assert.equal(await dynamics.locator(".js-plotly-plot").last().evaluate(n => n.data.length), 1, "one participation trace");
    audited += await auditEmptyFields(dynamics);
    const experimentDrive = dynamics.locator("#experimental-external_drive_mv");
    await experimentDrive.fill("");
    const beforeEmpty = simulationCount(calls);
    await dynamics.getByRole("button", { name: "Run comparison", exact: true }).click();
    await dynamics.locator("#experimental-external_drive_mv-error").waitFor();
    assert.equal(simulationCount(calls), beforeEmpty);
    await experimentDrive.fill("22");
    await dynamics.getByRole("button", { name: /^Reduced inhibition/ }).click();
    await dynamics.locator("[data-testid=comparison-view]").waitFor();
    assert.equal(await dynamics.locator("[data-testid=network-results]").count(), 1, "no invented experimental charts before running");
    assert.match(await dynamics.locator("form").innerText(), /2 -> 1 mV \/ spike/);
    assert.match(await dynamics.locator("table").innerText(), /Not run/);
    await dynamics.getByRole("button", { name: "Run comparison", exact: true }).click();
    await dynamics.locator("[aria-busy=false]").waitFor();
    await page.waitForFunction(() => document.querySelectorAll("#epilepsy-dynamics .js-plotly-plot").length === 5);
    const comparison = calls.filter(c => c.path === "/api/network/compare").at(-1).body;
    assert.deepEqual(comparison.changes, [{ parameter: "inhibitory_weight_mv", reference: 2, experimental: 1 }]);
    assert.deepEqual(scientific(comparison.reference.network), scientific(baseline.reference.network));
    assert.notDeepEqual(comparison.experimental.network.spike_times_ms, comparison.reference.network.spike_times_ms);
    const delta = comparison.experimental.network.summary.mean_firing_rate_hz - comparison.reference.network.summary.mean_firing_rate_hz;
    const deltaText = await dynamics.locator("tbody tr").first().locator("td").last().innerText();
    if (delta > 0) assert.match(deltaText, /^\+/);
    const beforeSwitches = simulationCount(calls);
    await choose(page, /Single Neuron/, "single-neuron");
    assert.equal(await drive.inputValue(), "");
    assert.equal(await neuron.locator(".js-plotly-plot").count() <= 2, true);
    await choose(page, /Neural Network/, "network-lab");
    assert.equal(await network.locator("#network-duration_ms").inputValue(), "");
    assert.equal(await weight.inputValue(), "0.75");
    await choose(page, /Epilepsy Dynamics/, "epilepsy-dynamics");
    assert.equal(await dynamics.locator("#experimental-inhibitory_weight_mv").inputValue(), "1");
    await dynamics.locator("[data-testid=comparison-view]").waitFor();
    assert.equal(await dynamics.locator("[data-testid=network-results]").count(), 2);
    assert.equal(simulationCount(calls), beforeSwitches);
    await page.goBack();
    await page.locator('[data-testid=active-lab][data-lab=network-lab]').waitFor();
    await page.goForward();
    await page.locator('[data-testid=active-lab][data-lab=epilepsy-dynamics]').waitFor();
    await dynamics.getByRole("button", { name: /^Reference/ }).click();
    await dynamics.locator("[data-testid=reference-view]").waitFor();
    assert.equal(await dynamics.locator("[data-testid=network-results]").count(), 1);
    assert.equal(simulationCount(calls), beforeSwitches);
    // Reproduce the reference explicitly; rendering stays compact.
    await dynamics.getByRole("button", { name: "Run comparison", exact: true }).click();
    await dynamics.locator("[aria-busy=false]").waitFor();
    assert.deepEqual(calls.filter(c => c.path === "/api/network/compare").at(-1).body.changes, []);
    await page.evaluate(() => { window.location.hash = "#neuron-lab"; });
    await page.locator('[data-testid=active-lab][data-lab=single-neuron]').waitFor();
    assert.equal(await drive.inputValue(), "", "legacy alias retains the same session");
    await page.evaluate(() => { window.location.hash = "#about"; });
    assert.equal(await page.locator('[data-testid=active-lab]').getAttribute("data-lab"), "single-neuron");
    // Direct links must select before any unrelated simulation starts.
    const deep = await browser.newPage();
    const deepCalls = [];
    await connect(deep, deepCalls);
    await deep.goto(frontend + "#epilepsy-dynamics");
    await deep.locator("[data-testid=reference-view]").waitFor();
    assert.equal(deepCalls.filter(c => c.path === "/api/lif").length, 0);
    assert.equal(deepCalls.filter(c => c.path === "/api/network/compare").length, 1);
    assert.equal(await deep.locator("#neuron-lab, #network-lab").count(), 0);
    // Narrow selector has readable cards, visible horizontal overflow, disabled NEXT.
    await deep.setViewportSize({ width: 390, height: 844 });
    const selector = deep.getByRole("navigation", { name: "Lab selector" });
    await selector.scrollIntoViewIfNeeded();
    await selector.evaluate(n => { n.scrollLeft = 0; });
    const dimensions = await selector.evaluate(n => ({ width: n.clientWidth, scroll: n.scrollWidth, card: n.querySelector("a").getBoundingClientRect().width }));
    assert(dimensions.scroll > dimensions.width);
    assert(dimensions.card >= 220 && dimensions.card < dimensions.width, "readable card with next-card peek");
    assert.equal(await selector.getByRole("button", { name: /Seizure Forecasting/ }).isDisabled(), true);
    assert(await deep.getByText("Swipe or scroll to explore labs", { exact: false }).isVisible());
    await deep.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    if (process.env.SCREENSHOT_PATH) await deep.screenshot({ path: process.env.SCREENSHOT_PATH });
    assert.equal(audited, 20);
    assert.deepEqual(errors, []);
    assert(calls.every(c => c.status === 200));
    console.log("PASS: all 20 numeric fields, empty/delete/replacement, negatives, decimals, bounds, integers, Tab/arrows/Enter, no invalid requests; one active lab, preserved drafts/results/in-flight work, baseline dedup, deep links and alias, history, pending/completed/reference modes, signed differences, mobile selector, disabled future lab.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
