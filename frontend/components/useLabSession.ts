"use client";

import { useCallback, useRef, useState } from "react";
import { draftOf, type Draft, type FieldErrors } from "./numeric-input";

export type LabSession<P extends object, R> = {
  values: Draft<P>; result: R | null; loading: boolean; error: string;
  validation: FieldErrors<P>;
};
export type LabController<P extends object, R> = {
  state: LabSession<P, R>;
  initialize: () => void;
  edit: (key: keyof P, value: string) => void;
  choose: (parameters: P) => void;
  validate: (errors: FieldErrors<P>) => void;
  run: (parameters: P) => Promise<void>;
};

// Three small parent-owned sessions keep data, not hidden mounted lab trees.
// Pending requests can finish into their session while a different lab is active.
export function useLabSession<P extends object, R>(
  defaults: P, loadInitial: () => Promise<R>, execute: (parameters: P) => Promise<R>,
): LabController<P, R> {
  const [state, setState] = useState<LabSession<P, R>>(() => ({
    values: draftOf(defaults), result: null, loading: true, error: "", validation: {},
  }));
  const initialized = useRef(false);
  const pending = useRef(false);
  const finish = useCallback(async (request: Promise<R>) => {
    try {
      const result = await request;
      setState(previous => ({ ...previous, result, error: "" }));
    } catch (error) {
      setState(previous => ({ ...previous, error: error instanceof Error ? error.message : "Simulation unavailable. Please retry." }));
    } finally {
      pending.current = false;
      setState(previous => ({ ...previous, loading: false }));
    }
  }, []);
  const initialize = useCallback(() => {
    if (initialized.current) return;
    initialized.current = true;
    pending.current = true;
    void finish(loadInitial());
  }, [finish, loadInitial]);
  const run = useCallback(async (parameters: P) => {
    if (pending.current) return;
    pending.current = true;
    setState(previous => ({ ...previous, loading: true, error: "", validation: {} }));
    await finish(execute(parameters));
  }, [execute, finish]);
  const edit = useCallback((key: keyof P, value: string) => {
    setState(previous => ({ ...previous, values: { ...previous.values, [key]: value },
      validation: {} }));
  }, []);
  const choose = useCallback((parameters: P) => {
    setState(previous => ({ ...previous, values: draftOf(parameters), validation: {} }));
  }, []);
  const validate = useCallback((validation: FieldErrors<P>) => {
    setState(previous => ({ ...previous, validation }));
  }, []);
  return { state, initialize, run, edit, choose, validate };
}
