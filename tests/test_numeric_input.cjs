// Uses the project's existing TypeScript compiler and Node test runner.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("frontend/components/numeric-input.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsObject });
const { readNumber, validateNumbers, draftOf } = exportsObject;
test("empty, incomplete, non-finite and malformed drafts never become zero", () => {
  for (const value of ["", " ", "-", "+", ".", "-.", "1e", "1e-", "NaN", "Infinity", "1e309", "4x", "0x10"])
    assert.equal(readNumber(value), null, value);
});
test("complete decimal, negative and exponent drafts parse without rewriting", () => {
  for (const [text, value] of [["4", 4], ["0", 0], ["0.75", 0.75], ["-65", -65], ["-.5", -.5], ["2e1", 20]])
    assert.equal(readNumber(text), value);
  assert.equal(draftOf({ drive: 22, rest: -65 }).drive, "22");
});
test("range, exclusive bound, integer, and scientific duration rules are enforced", () => {
  const rules = [
    { key: "tau", label: "Time constant", min: 0, max: 200, exclusiveMin: true },
    { key: "seed", label: "Seed", min: 0, max: 4294967295, integer: true },
    { key: "duration", label: "Duration", min: 50, max: 1000, integer: true, multipleOf: 5 },
  ];
  for (const values of [
    { tau: "", seed: "42", duration: "500" }, { tau: "0", seed: "42", duration: "500" },
    { tau: "201", seed: "42", duration: "500" }, { tau: "20", seed: "1.2", duration: "500" },
    { tau: "20", seed: "-1", duration: "500" }, { tau: "20", seed: "42", duration: "501" },
  ]) assert.equal(validateNumbers(values, rules).parameters, null);
  const valid = validateNumbers({ tau: ".25", seed: "42", duration: "505" }, rules);
  assert.equal(Object.keys(valid.errors).length, 0);
  assert.equal(valid.parameters.tau, .25);
});
