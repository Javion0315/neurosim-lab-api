# Methodology

## LIF neuron

The simulated membrane follows `tau_m dV/dt = -(V - V_rest) + R I`, with `R I` entered as a steady-state voltage drive in mV. Forward Euler uses a fixed 0.1 ms step. A step reaching threshold records a spike, resets the membrane, and holds it at reset during an absolute refractory period. The displayed voltage trace does not represent the shape of an action potential.

Rate is spike count divided by full simulation duration. ISI is the difference between consecutive spike times; CV is population standard deviation of ISIs divided by their mean. CV is undefined for fewer than three spikes here.

## Synthetic demo

Each demo neuron is an independent Poisson process with an 8 Hz target rate and fixed random seed 7. The plotted points are simulated, not measured. The summary rate is the mean rate per neuron; pooled intervals between different neurons are not reported as ISIs.

## Scientific limitations

The Phase 1 LIF model omits ion channels, morphology, adaptation, and stochastic synaptic input. Future SNN simulations will not directly reproduce biological brains. STDP is only one model of plasticity. Similar spike statistics do not establish biological equivalence.


## Phase 2: recurrent excitatory-inhibitory LIF network

**SIMULATED.** This simplified network is designed to study computational principles of excitation, inhibition, connectivity, and collective activity. It is not a patient-specific or anatomically complete model. Spikes are not EEG, and synchronized firing is not a seizure.

### Engine and neuron equation

Brian2 2.10.1 executes with its NumPy runtime (`NumpyCodeObject`), without C/C++ compilation. Each request builds an explicit `Network` with its own 0.2 ms clock; the Phase 1 single-neuron solver remains unchanged at 0.1 ms.

Between arriving synaptic events:

`tau_m * dV_i/dt = -(V_i - V_rest) + D + eta_i(t)`

- `tau_m = 20 ms`; `V_rest = V_reset = -65 mV`; threshold `-50 mV`.
- Forward Euler, `dt = 0.2 ms`, absolute refractory period `2 ms`.
- At threshold: record the event and reset. Voltage is held at reset during refractoriness; incoming voltage jumps during this interval are ignored by Brian's `unless refractory` mechanism.
- Initial voltages are independently uniform in `[-65, -50) mV` to avoid forcing identical initial phases.
- `D` is the constant voltage drive (`R * I`) used conceptually in the Single Neuron Lab.
- `eta_i(t)` consists of independent Gaussian samples with mean 0 and standard deviation 4 mV, resampled every 1 ms and held between samples. This is piecewise constant input noise, not continuous white noise, a Poisson synaptic input, or a recording.

### Populations, connectivity, and synapses

Default: 100 neurons, 80 excitatory / 20 inhibitory. This approximate ratio is an educational choice, not universal across brain regions. `N_E = floor(N * excitatory_fraction + 0.5)`, `N_I = N - N_E`; the response includes actual rounded composition and inclusive, zero-based index ranges. E neurons precede I neurons.

For each directed pair of different neurons, independently sample a connection with probability `p` (default 0.1). There are no self-connections or duplicate edges; E-to-E, E-to-I, I-to-E, and I-to-I connections are eligible. Every output from one neuron has the same sign (Dale-like assignment). A fixed 1 ms delay precedes each synaptic voltage jump:

`V_post <- V_post + w_E` for an excitatory source;
`V_post <- V_post - w_I` for an inhibitory source.

Defaults: `w_E = 0.5 mV`, `w_I = 2 mV` (positive magnitude). These are instantaneous voltage-jump synapses, not conductance or receptor-kinetic models. There is no STDP, adaptation, anatomical geometry, or plasticity. Brian's standard threshold/synapse/reset scheduling means a synaptic jump is evaluated for spiking at the next threshold step. Unnormalized weights make network size and connectivity affect total recurrent influence.

### Rates and synchronization proxy

For non-overlapping 5 ms bins spanning the entire run:

`r_E[k] = count_E[k] / (N_E * 0.005 s)`
`r_I[k] = count_I[k] / (N_I * 0.005 s)`
`r_total[k] = (count_E[k] + count_I[k]) / (N * 0.005 s)`

Rate-series times are bin centers; intervals are left-inclusive, right-exclusive. Durations must be multiples of 5 ms, so there is no partial final bin. Whole-run mean rates divide spike counts by population size and full duration in seconds. Transients are included; there is no burn-in removal.

The **population-rate coefficient of variation** is:

`CV = sqrt(sum((r_total[k] - mean(r_total))**2) / K) / mean(r_total)`

This uses population standard deviation (`ddof=0`) across all bins, including empty bins. It is dimensionless, unbounded above, and `null` when the mean rate is zero. Zero means identical counts in every bin. A higher value describes stronger temporal variability, which can accompany concentrated population activity; it does not by itself establish neuron-to-neuron synchrony. Sparse activity, neuron count, input fluctuations, bin width, and startup transients are confounds. It is not a calibrated score or pairwise correlation. Compare matched network size, bin width, and duration.

**Synchronization describes the extent to which many neurons become active together. High synchronization is not automatically pathological.**

### Scope and evidence

Individual neurons follow simple rules, but interactions can generate collective behavior (emergent dynamics). No model output is presented as biological validation. No EEG generation, seizure detector, pathological mode, clinical classifier, or treatment effect is implemented. Phase 3 extends these same computational mechanisms with matched comparisons, documented below.

Engine references: [Brian2 2.10.1 documentation](https://brian2.readthedocs.io/en/2.10.1/), [synapses](https://brian2.readthedocs.io/en/2.10.1/user/synapses.html), [refractoriness](https://brian2.readthedocs.io/en/2.10.1/user/refractoriness.html). These document simulator mechanisms, not biological validity of this educational parameterization.


## Phase 3: matched network-state experiments

**Scientific question:** How can changes in excitation, inhibition, connectivity,
and external drive shift a simulated neural network from distributed activity
toward strongly coordinated population dynamics?

A **network state transition** is a change in collective network behavior that
emerges when underlying parameters or interactions change. A numerical difference
between two short runs does not itself establish a qualitative transition.
The UI encourages intermediate parameter values and one-variable experiments;
it does not classify regimes using arbitrary clinical thresholds.

### Model decision and reference

The exact Phase 2 LIF neuron equations, voltage-jump synapses, input noise,
integration method, and defaults above are retained. No additional neuron model
is introduced. This is sufficient for educational controlled comparisons of
activity and co-activity; it is not established as a model of biologically
meaningful bursting or seizures. The LIF cells have no intrinsic adaptation
or bursting mechanism. No burst detector or burst-event annotations are implemented.

The **Reference Network** uses 100 neurons, excitatory fraction 0.8, connection
probability 0.1, excitatory strength 0.5 mV, inhibitory magnitude 2 mV, drive
22 mV, duration 500 ms, and seed 42. It is a computational baseline, not a
healthy brain or a control patient.

Only four parameters are exposed in Phase 3. The reference preset changes none.
Other presets each reset to the reference and change exactly one parameter:

| Experiment | Reference | Experimental | Parameter |
| --- | --- | --- | --- |
| Increased excitation | 0.5 mV/spike | 0.75 mV/spike | excitatory_weight_mv |
| Reduced inhibition | 2 mV/spike | 1 mV/spike | inhibitory_weight_mv |
| Increased connectivity | 0.10 | 0.15 | connection_probability |
| Increased external drive | 22 mV | 26 mV | external_drive_mv |

These are modest, transparent arithmetic changes, not optimized seizure
parameterizations. Any allowed combination is accepted, but multiple changes are
flagged as harder to interpret. No outcome (including increased synchronization)
is assumed or required.

### Coordination measure: temporal population participation

For each non-overlapping, left-inclusive/right-exclusive 5 ms bin k:

    a[k] = (1/N) * sum_i 1{neuron i fires at least once in bin k}
    mean_active_fraction = sum_k a[k] / K
    peak_active_fraction = max_k a[k]

The sequence and both summaries lie in [0, 1], including zero for silence.
Repeated spikes from one neuron within a bin count only once. The sequence uses
the same bin centers as the population rates. All bins, including startup, are
included. The calculation is O(spikes + N*K) and uses a K-by-N boolean occupancy
array; Phase 3 has just 100*100 entries. It avoids expensive pairwise correlations.

Interpretation: larger a[k] means more distinct neurons active in a shared time
window. The peak describes the strongest measured window, not a sustained state.
The mean measures average participation and is often redundant with firing rate
at low rates. Neither summary measures excess coincidence above chance.
Independent neurons can have high participation at high firing rates.

Limitations: bin width and alignment, firing rate, network size, observation
duration, input fluctuations, and startup transients affect values. Longer bins
increase the opportunity to participate; shifting bin boundaries can split
coincident activity. Peak participation is sensitive to a single bin and to the
number of bins observed. Compare matched settings. No smoothing, baseline
subtraction, significance test, burst threshold, or clinical score is applied.

Population-rate CV remains unchanged: std(total_hz, ddof=0)/mean(total_hz),
null for silence. It measures temporal count variability, not direct pairwise
synchrony; its limitations and bin-size dependence remain as documented above.

### Comparison and reproducibility

Both conditions call the existing simulator. Fixed settings: N=100, 80 E/20 I,
500 ms, seed 42, Euler dt=0.2 ms, fixed noise amplitude/time step and neuron
constants. Separate SeedSequence streams guarantee the same initial voltages and
noise samples for these matched shapes. Weight/drive changes retain identical
connectivity. For a probability change, the same uniform matrix is thresholded
at the new p: edge sets are nested when p increases, not independently resampled.
The adjacency hashes and all parameters remain available in the result.

The reference is always generated from NetworkParameters(), independently of
editable Phase 2 controls. Same settings produce one simulation reused for both
conditions. Different settings run sequentially under one shared process lock
and the same 10-second cooperative deadline. At most 100,000 neuron-ms are run
per comparison, equal to Phase 2's existing maximum request budget.

The two raster plots have matching time and neuron axes; E/I rate plots share a
common rate axis. A comparison table reports absolute values and experimental
minus reference differences. Participation traces overlay on fixed [0,1] axes.
No region is labeled clinically and no peak is called a seizure or burst.

### Baseline autoload

On first selection of either network-based lab, the frontend uses one
module-scoped promise for POST /api/network/compare with an empty body. The
reference preset runs the exact Phase 2 default simulator once. Phase 2 displays
reference.network; Phase 3 initially displays one Reference Network result set
and one participation trace. The inactive lab uses this same baseline when
selected later. No precomputed or invented activity is used. Loading is visible
and controls are disabled until completion.

Phase 3.1 mounts only the selected laboratory. Parent-owned React session hooks
preserve raw input drafts, results, errors and pending work across switches.
Initialization is guarded against repeat effects; completed work updates its
own session even if that lab is no longer mounted. Single Neuron is the default,
and direct links resolve before any lab mounts. The separate synthetic archive
demo loads when its section approaches the viewport.

Changing a Phase 3 draft opens the comparison layout immediately. Until a matching
experiment completes, its cells say Not run and its plot area prompts a run.
The reference remains available. Returning to unchanged reference parameters
collapses to one result set, without modifying or inventing scientific outputs.
All numeric drafts remain strings; validated finite typed numbers alone reach
simulation endpoints. Scientific equations, defaults, metrics and API behavior
are unchanged by this UX refinement.

A successful baseline is cached for the browser module lifetime (reload refreshes
it). Failed baseline promises are evicted; each lab's Run button can retry.
Manual Phase 2 runs retain POST /api/network and use the exact visible parameters.
Frontend network requests are serialized per tab to avoid its own two labs
colliding with Brian2's process lock. Other clients can still receive 503/retry.
There is a 30-second fetch timeout; client disconnects do not cancel backend work.

### Scientific boundary and evidence

This model studies computational mechanisms that can produce seizure-like
population dynamics. It does not reproduce the full biological complexity of
epilepsy and cannot diagnose, predict, or represent an individual patient's seizures.

- High firing rate alone is not a seizure.
- High synchronization alone is not a seizure.
- Reduced inhibition alone is not epilepsy.
- A simulated population burst is not automatically a biological seizure.
- No single synchronization metric determines whether a biological seizure is occurring.

The model simplifies or omits realistic cell diversity, detailed ion channels,
spatial anatomy, heterogeneous synaptic dynamics, realistic cortical connectivity,
patient-specific parameters, seizure onset zones, extracellular field generation,
and EEG forward modeling. Population rates and spikes are not EEG.

**SIMULATED RESULT:** all network plots, measures, and differences here.
**REAL DATA:** the existing DANDI explorer returns archive metadata, not recordings.
**FUTURE VALIDATION:** independently compare appropriate observables with real
epilepsy electrophysiology, using a justified observation model and uncertainty
analysis. Level 4, Real EEG, is next; it is not implemented in this phase.
