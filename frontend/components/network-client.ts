export type Parameters = {
  neuron_count: number;
  excitatory_fraction: number;
  connection_probability: number;
  excitatory_weight_mv: number;
  inhibitory_weight_mv: number;
  external_drive_mv: number;
  duration_ms: number;
  seed: number;
};
export type Result = {
  kind: "simulation";
  model_name: string;
  engine_version: string;
  execution_time_ms: number;
  parameters: Parameters;
  populations: {
    neuron_count: number; excitatory_count: number; inhibitory_count: number;
    connection_count: number; actual_excitatory_fraction: number;
  };
  spike_times_ms: number[];
  neuron_indices: number[];
  rates: { bin_width_ms: number; time_ms: number[]; excitatory_hz: number[]; inhibitory_hz: number[]; total_hz: number[] };
  summary: {
    total_spikes: number; mean_firing_rate_hz: number; excitatory_mean_firing_rate_hz: number;
    inhibitory_mean_firing_rate_hz: number; population_rate_cv: number | null;
  };
};
export const defaults: Parameters = {
  neuron_count: 100, excitatory_fraction: 0.8, connection_probability: 0.1,
  excitatory_weight_mv: 0.5, inhibitory_weight_mv: 2, external_drive_mv: 22, duration_ms: 500, seed: 42,
};

export type Experiment = Pick<Parameters, "excitatory_weight_mv" | "inhibitory_weight_mv" | "connection_probability" | "external_drive_mv">;
export type Condition = {
  network: Result;
  coordination: { bin_width_ms: number; active_fraction: number[]; mean_active_fraction: number; peak_active_fraction: number };
};
export type Comparison = {
  kind: "simulation"; reference: Condition; experimental: Condition;
  changes: { parameter: keyof Experiment; reference: number; experimental: number }[];
  execution_time_ms: number; fixed_conditions: string;
};

// Serialize this tab's network work: Brian2 allows one active request per process.
let queue: Promise<unknown> = Promise.resolve();
function request<T>(path: string, parameters: object): Promise<T> {
  const task = queue.then(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(path, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parameters), signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.detail === "string" ? body.detail :
          response.status === 422 ? "Check the parameter ranges and work limit." :
          "The network service is unavailable. Please retry shortly.");
      }
      return await response.json() as T;
    } catch (error) {
      if (controller.signal.aborted) throw new Error("The request timed out. Please retry shortly.");
      throw error;
    } finally { clearTimeout(timeout); }
  });
  queue = task.catch(() => undefined);
  return task;
}
export const runNetwork = (parameters: Parameters) => request<Result>("/api/network", parameters);
export const runComparison = (parameters: Experiment | Record<string, never>) => request<Comparison>("/api/network/compare", parameters);

// One exact default simulation shared by both mounted labs, including Strict Mode.
// Cache only the baseline; a failed load can be retried via either Run button.
let baseline: Promise<Comparison> | undefined;
export function loadBaseline(): Promise<Comparison> {
  if (!baseline) baseline = runComparison({}).catch(error => { baseline = undefined; throw error; });
  return baseline;
}
