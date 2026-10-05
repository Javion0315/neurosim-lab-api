export type Draft<P> = { [K in keyof P]: string };
export type FieldErrors<P> = Partial<Record<keyof P, string>>;
export type NumericRule<K extends string> = {
  key: K; label: string; min: number; max: number; integer?: boolean;
  exclusiveMin?: boolean; multipleOf?: number;
};

export function draftOf<P extends object>(parameters: P): Draft<P> {
  return Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, String(value)])) as Draft<P>;
}

// Empty and incomplete drafts are never zero. Keep the raw string in the input.
export function readNumber(raw: string): number | null {
  const text = raw.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function validateNumbers<K extends string>(
  values: Record<K, string>, rules: readonly NumericRule<K>[],
): { parameters: Record<K, number> | null; errors: Partial<Record<K, string>> } {
  const parameters = {} as Record<K, number>;
  const errors: Partial<Record<K, string>> = {};
  for (const rule of rules) {
    const value = readNumber(values[rule.key]);
    if (value === null) errors[rule.key] = "Enter a valid " + rule.label.toLowerCase() + ".";
    else if (rule.integer && !Number.isInteger(value)) errors[rule.key] = rule.label + " must be a whole number.";
    else if (value > rule.max || (rule.exclusiveMin ? value <= rule.min : value < rule.min))
      errors[rule.key] = rule.label + " must be " + (rule.exclusiveMin ? "greater than " : "at least ") + rule.min + " and at most " + rule.max + ".";
    else if (rule.multipleOf && Math.abs(value / rule.multipleOf - Math.round(value / rule.multipleOf)) > 1e-9)
      errors[rule.key] = rule.label + " must be a multiple of " + rule.multipleOf + ".";
    else parameters[rule.key] = value;
  }
  return { parameters: Object.keys(errors).length ? null : parameters, errors };
}

export function focusInvalid(form: HTMLFormElement) {
  requestAnimationFrame(() => form.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
}
