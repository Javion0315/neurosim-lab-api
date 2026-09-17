# Methodology

## LIF neuron

The simulated membrane follows `tau_m dV/dt = -(V - V_rest) + R I`, with `R I` entered as a steady-state voltage drive in mV. Forward Euler uses a fixed 0.1 ms step. A step reaching threshold records a spike, resets the membrane, and holds it at reset during an absolute refractory period. The displayed voltage trace does not represent the shape of an action potential.

Rate is spike count divided by full simulation duration. ISI is the difference between consecutive spike times; CV is population standard deviation of ISIs divided by their mean. CV is undefined for fewer than three spikes here.

## Synthetic demo

Each demo neuron is an independent Poisson process with an 8 Hz target rate and fixed random seed 7. The plotted points are simulated, not measured. The summary rate is the mean rate per neuron; pooled intervals between different neurons are not reported as ISIs.

## Scientific limitations

LIF omits ion channels, morphology, adaptation, and stochastic synaptic input. Future SNN simulations will not directly reproduce biological brains. STDP is only one model of plasticity. Similar spike statistics do not establish biological equivalence.
