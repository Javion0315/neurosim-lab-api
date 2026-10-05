export type EEGParameters = { recording_id: string; channels: string; start_s: number; end_s: number; comparison_start_s: number; comparison_end_s: number; mode: string };
export const eegDefaults: EEGParameters = { recording_id: "chb01_03", channels: "FP1-F7,FP2-F8", start_s: 2986, end_s: 3006, comparison_start_s: 3006, comparison_end_s: 3026, mode: "single" };
export type EEGMetadata = {
  recording_id: string; dataset: string; provider: string; dataset_version: string; doi: string;
  source_recording: string; source_url: string; dataset_url: string; annotation_url: string;
  sampling_hz: number; unit: string; stored_start_s: number; stored_end_s: number;
  annotation: { start_s: number; end_s: number; label: string };
  channels: { name: string; source_index: number; source_prefilter: string; physical_min: number; physical_max: number; digital_min: number; digital_max: number }[];
  artifact: string; artifact_format: string; artifact_bytes: number; artifact_sha256: string; source_sha256: string;
  preprocessing: string; calibration: string; license: string; license_url: string; citation: string; dates: string;
};
export type EEGChannel = {
  name: string; voltage_uv: number[];
  features: { mean_uv: number; variance_uv2: number; rms_uv: number; line_length_uv: number; peak_to_peak_uv: number };
  psd: { frequency_hz: number[]; density_uv2_per_hz: number[]; segment_count: number };
};
export type EEGWindow = { start_s: number; end_s: number; sample_count: number; time_s: number[]; channels: EEGChannel[] };
export type EEGResult = { kind: "real_eeg"; provenance: EEGMetadata; windows: EEGWindow[] };
export const eegChannels = ["FP1-F7", "F7-T7", "T7-P7", "P7-O1", "FP2-F8", "F8-T8", "T8-P8", "P8-O2"];
export const eegPresets = [
  { name: "Before annotated seizure", start: 2976, end: 2996 },
  { name: "Around annotated seizure onset", start: 2986, end: 3006 },
  { name: "During annotated seizure", start: 3006, end: 3026 },
  { name: "Around annotated seizure end", start: 3026, end: 3046 },
  { name: "After annotated seizure", start: 3036, end: 3056 },
];
export async function runEEG(p: EEGParameters): Promise<EEGResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const windows = [{ start_s: p.start_s, end_s: p.end_s }];
    if (p.mode === "compare") windows.push({ start_s: p.comparison_start_s, end_s: p.comparison_end_s });
    const response = await fetch("/api/eeg/recordings/" + encodeURIComponent(p.recording_id) + "/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels: p.channels.split(",").filter(Boolean), windows }), signal: controller.signal,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Check EEG channels and window bounds.");
    if (body.kind !== "real_eeg") throw new Error("The service did not return real EEG.");
    return body;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Real EEG request timed out. Please retry.");
    throw error;
  } finally { clearTimeout(timeout); }
}
export const loadEEG = () => runEEG(eegDefaults);
