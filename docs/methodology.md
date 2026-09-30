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

Individual neurons follow simple rules, but interactions can generate collective behavior (emergent dynamics). No model output is presented as biological validation. No EEG generation, seizure detector, pathological mode, clinical classifier, or treatment effect is implemented. Level 3, Epilepsy Dynamics, remains the next development stage.

Engine references: [Brian2 2.10.1 documentation](https://brian2.readthedocs.io/en/2.10.1/), [synapses](https://brian2.readthedocs.io/en/2.10.1/user/synapses.html), [refractoriness](https://brian2.readthedocs.io/en/2.10.1/user/refractoriness.html). These document simulator mechanisms, not biological validity of this educational parameterization.
