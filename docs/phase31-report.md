# Phase 3.1: UX, numeric editing, and laboratory navigation

Verified locally on 2026-10-05. Phase 4 was not implemented. No deployment was
performed. Scientific models, default parameters, metrics, seeds, backend
validation, API contracts, Vercel routing and environment files are unchanged.

## 1. Root cause and numeric-state strategy

Single Neuron previously stored numeric parameters directly and ran
Number(e.target.value) on every onChange. Number("") is zero, so deleting 22
immediately inserted 0; typing 4 could leave 04.

All 20 controls now store raw strings. onChange updates that string only.
Neither empty nor intermediate values are coerced into zero, and blur never
silently restores a value. The visible input is not normalized each keystroke.
Native number inputs retain keyboard arrows and browser editing behavior.

numeric-input.ts separates parsing/validation from editing. readNumber returns
null for empty, incomplete, non-finite and malformed strings. Complete decimal,
negative and exponent forms parse into finite numbers. Submission checks each
parameter's scientific range, integer requirement, and scientific multiple where
applicable. Form noValidate suppresses browser popups in favor of explicit,
consistent application validation; it does not bypass application or API checks.

Forms submit on Run or Enter. Invalid fields get inline text, aria-invalid and
aria-describedby; an alert summarizes the problem and focus moves to the first
invalid field. No request is sent. Editing clears prior validation messages,
which are recalculated at the next submission, avoiding stale cross-field errors.
Valid submission creates a fresh typed numeric parameter object.

Scientific request state and completed result.parameters stay distinct from the
editing draft. Parameter edits do not change completed scientific results.
Network size/work summaries are omitted or marked incomplete when drafts are
invalid instead of displaying an invented zero-based calculation.

## 2. Files changed

| File | Change |
| --- | --- |
| frontend/app/page.tsx | Replace stacked labs with LabWorkspace; compact header; lazy archive demo; retain surrounding scientific content |
| frontend/components/LabWorkspace.tsx | New explicit selector, active-only mounting, hash/history handling, parent-owned sessions |
| frontend/components/useLabSession.ts | Small reusable session hook for drafts, results, validation, loading and pending requests |
| frontend/components/numeric-input.ts | Shared raw-draft conversion, finite parsing, range/integer/multiple validation, invalid-field focus |
| frontend/components/NeuronLab.tsx | Extract existing lab; fix editing; explicit validation; preserve plots and explanations |
| frontend/components/NetworkLab.tsx | Use retained session and shared validation; avoid invalid draft-derived summaries |
| frontend/components/DynamicsLab.tsx | Retained session, validated inputs, compact reference view, pending/completed comparison, signed differences |
| frontend/components/network-client.ts | Update baseline lifecycle comment only; request behavior unchanged |
| tests/test_numeric_input.cjs | Three Node unit tests covering parser and validation cases |
| tests/browser_phase31.cjs | New comprehensive production-browser UX/navigation regression |
| tests/browser_phase3.cjs | Adapt existing regression navigation and expected compact-reference layout; retain scientific and interaction assertions |
| README.md | Navigation, draft validation, current behavior and test instructions |
| docs/methodology.md | Current on-demand baseline and presentation-state lifecycle |
| docs/reproducibility.md | UI/API separation, session scope, additional verification commands |
| docs/phase31-report.md | This report |

No dependencies were added or upgraded. Generated next-env.d.ts and
tsconfig.tsbuildinfo changes were restored to their pre-task contents.

## 3. Fields audited and validation

| Lab | Fields | Enforced scientific constraints |
| --- | --- | --- |
| Single Neuron (8) | Input drive; membrane time constant; resting, threshold and reset potentials; refractory period; duration; seed | Existing individual ranges; time constant >0; rest/reset below threshold; integer seed |
| Neural Network (8) | Network size; excitatory fraction; connection probability; excitatory and inhibitory weights; external drive; duration; seed | Existing ranges; integer size/duration/seed; duration multiple of 5 ms; size*duration <=100,000 neuron-ms |
| Epilepsy Dynamics (4) | Excitatory and inhibitory weights; connection probability; external drive | Existing Phase 3 ranges; fixed network settings remain controlled by unchanged backend schema |

Single Neuron frontend ranges now mirror the existing LIFParameters schema:
drive [-100,100], time constant (0,200], rest/reset [-100,30], threshold [-100,50],
refractory [0,50], duration [20,2000], seed integer [0,4294967295].
Network and experimental ranges are unchanged.

The Network Lab excitatory-weight arrow increment is now 0.05 mV instead of 0.1
so 0.75 is convenient to enter. This is an editing increment, not a simulation
parameter/default change. Scientific float values are checked against backend
bounds, not unnecessarily restricted to an arbitrary input step lattice.
Network duration's 5 ms divisibility and integer-only fields remain enforced.

## 4. Navigation architecture

Explore NeuroSim Lab is an explicit card selector, separate from the retained
Learning + Research Roadmap. Each card has a visible level, lab name and
IMPLEMENTED status, an Open lab affordance, hover styling and keyboard focus.
The active card has a mint border/background, Selected workspace text and
aria-current. Native links support Tab and Enter without custom keyboard traps.

Single Neuron is the default on a fresh hashless homepage. The sequence remains
Single Neuron -> Neural Network -> Epilepsy Dynamics. Real EEG appears as a
disabled, dashed NEXT card with Not available yet text. No future simulation
or fake result is implemented. Future implemented labs can extend the selector
registry and add one controller/component without redesigning the page.

Exactly one complete lab tree is mounted. There are no hidden full lab copies.
Inactive charts unmount and release their Plotly resources. Each active lab
retains its level, title, SIMULATED evidence label, controls, plots, explanations,
and Learn / Experiment / Observe / Explain / Research material.

On narrow screens the selector scrolls horizontally, keeps cards readable,
exposes part of the next card, and displays an explicit swipe/scroll hint.
When selecting a lab in a narrow viewport, its active card is brought into view.
Desktop uses four cards across. The main header points to Explore Labs rather
than growing by one navigation item per future phase.

## 5. State, requests, and deep links

Three ordinary React session hooks live in LabWorkspace. They retain drafts,
last completed results, loading/errors and request guards while child labs
unmount. No global state framework, localStorage or hidden mounted charts are used.
An in-flight request can finish into its originating session after switching away.

Lab initialization happens only on first selection. The initial network result
still uses the exact existing shared baseline promise and simulator. Selecting
the other network lab later reuses that reference. Unchanged manual Phase 2
defaults still reproduce the automatic result. The session request guard and
shared baseline promise avoid duplicate work on re-renders, switches and repeated
effect setup. The Single Neuron baseline is similarly deduplicated.

The synthetic demo in the separate public archive loads when that section nears
the viewport, preserving the demo without launching unrelated simulation work
on the initial homepage. DANDI metadata search remains explicitly user-triggered.

Hash navigation uses useSyncExternalStore and native links/history:

- #single-neuron selects Single Neuron.
- #neuron-lab remains a working alias.
- #network-lab selects Neural Network.
- #epilepsy-dynamics selects Epilepsy Dynamics.
- No hash defaults to Single Neuron, including Back to the original URL.
- Unrelated anchors such as #about keep the current workspace selected.

The server/hydration initially renders the selector before mounting any lab.
Direct links are resolved before a simulation starts, so opening Phase 3 does
not issue an unnecessary Phase 1 request. Native history entries support
Back/Forward; the active selector and workspace agree with lab hashes.

## 6. Phase 3 reference-only state

When all draft parameters equal Reference, Phase 3 shows:

- One clearly labeled Reference Network.
- One spike raster and one E/I population-rate chart.
- One network summary and synchronization interpretation.
- Mean/peak participation summaries and one participation trace.
- The prompt: Reference baseline established. Choose an experimental condition
  or change a parameter to compare network dynamics.

No duplicate result column or identical reference/experimental table is shown.
The original Run comparison action still reproduces the reference through the
existing API. Choosing Reference after a completed experiment immediately
restores the compact view without forcing another simulation.

## 7. Comparison state and differences

A changed or incomplete draft immediately opens the comparison layout and shows
the exact pending change with its units. No simulation is triggered just by
editing or choosing a preset.

The Reference Network remains visible. Until a matching experimental result
completes, the experimental plot area prompts Run comparison and table cells
say Not run. Old or identical reference output is never presented as the new
experimental condition. The last completed result remains in session state;
restoring its exact parameters can display it again.

After a valid run, the reference and experimental rasters/rates, state table,
Difference column and participation traces appear with the existing aligned axes.
Positive differences explicitly include +; negative differences retain their
sign. Differences are experimental minus reference, in the row's units.
No direction is labeled better, worse, healthy, pathological or seizure.

All values come from the unchanged simulator. The Reduced Inhibition regression
checks actual returned outputs and explicit parameter differences, not hardcoded
measured firing rates.

## 8. Tests and smoke checks

New Node unit suite: **3 passed**.

    node --test tests/test_numeric_input.cjs

Covers empty/partial/malformed/non-finite rejection; decimal/negative/exponent
parsing; ranges; exclusive bounds; integer constraints; duration divisibility.

New browser suite: **passed**, using the production frontend and real backend.

    node tests/browser_phase31.cjs

Verified all 20 numeric controls, with:
- Select-all, Backspace/Delete, empty state, Tab/blur and restoration by typing.
- 22 -> empty -> 4 (not 04), ArrowUp/ArrowDown and Enter submission.
- Intermediate minus followed by -65, and 0.5 -> 0.75 committed as a number.
- Empty, non-integer, out-of-range, unsafe-duration and voltage-relationship
  submissions blocked before any API call; focus on invalid fields.
- One active lab tree; no inactive network/demo requests on initial load.
- Phase 2 default autoload and unchanged manual baseline equality.
- Switching away during pending baseline generation without duplicate requests.
- Retained incomplete drafts, completed results and experiment selections.
- Compact reference, pending comparison, completed Reduced Inhibition comparison,
  signed differences and explicit reference reproduction.
- Canonical deep links, legacy alias, direct Phase 3 loading without a Phase 1
  request, Back/Forward between labs and Back to the original hashless URL.
- Mobile selector dimensions/next-card peek, no document overflow, disabled NEXT.

Existing browser_phase3.cjs: **passed** after adapting navigation and compact-view
expectations to the requested architecture. Its baseline equality, plotted-data,
shared-axis, metric, stale-draft, Phase 1, network work-limit/silence, DANDI fixture
rendering and initial-503 recovery assertions remain.

Both suites reported no page JavaScript errors. Tests use external Playwright
via NODE_PATH (no application dependency) and FRONTEND_URL/BACKEND_URL overrides.
Browser routing mirrors Vercel routing to the real local backend; this is not a
hosted deployment test.

Live DANDI smoke test: **HTTP 200, five metadata records**.
Mobile layout was visually inspected at 390 px; desktop exercised at 1440 px.

## 9. Required verification results

| Check | Result |
| --- | --- |
| npm run lint | PASS |
| npm run typecheck | PASS |
| VERCEL=1 npm run build | PASS; homepage and research-vision prerendered |
| Full pytest, Python 3.13.15 | 67 passed in 20.77 seconds |
| Numeric-input Node tests | 3 passed |
| Phase 3 browser regression | PASS |
| Phase 3.1 browser regression | PASS |
| Live DANDI | HTTP 200, five records |

The initial extraction missed a type import used by the demo; that was corrected
before the final passing TypeScript/build checks. A history edge case returning
to the hashless default was found during review, fixed and covered by regression.

All backend source and existing Python tests remain byte-for-byte unchanged.
Vercel config, Next routing config, environment files and scientific defaults
remain unchanged. No Phase 4 work was started.

## 10. Remaining UX limits

- State retention is scoped to switching labs within the mounted homepage.
  A full reload or leaving/remounting the homepage resets drafts and last results;
  there is no cross-session storage.
- Plotly charts remount when returning to a lab. Scientific data is retained,
  but temporary plot zoom/pan is not retained.
- Native number-input handling of incomplete minus signs, decimals and exponent
  text can vary by browser. Completed negative/decimal entry and temporary empty
  state were verified in Edge; invalid intermediate values never reach the API.
- A selected experimental draft requires Run/Enter to compute results. The
  pending placeholder is intentional; parameter edits do not launch simulations.
- A request already submitted can finish while its lab is inactive. Switching
  does not abort useful work, and server contention still uses the existing
  visible retry/error behavior.
