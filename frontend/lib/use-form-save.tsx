"use client";

import { useCallback, useState } from "react";

/**
 * Status of a form save operation.
 *
 * - idle: nothing has happened yet, or the success/error toast has expired
 * - saving: in flight; `attempt` shows the current retry number (1..maxAttempts)
 * - saved: success — auto-clears back to idle after `successTimeoutMs`
 * - error: all retries exhausted; `message` is shown to the user
 */
export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving"; attempt: number }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export interface UseFormSaveOptions {
  /**
   * Path that the Server Action POSTs to (used by the fetch probe to detect
   * 503s that React would otherwise silently swallow). Defaults to the
   * current page URL — usually correct since Server Actions POST to the
   * page they're rendered on.
   */
  path?: string;
  /** Max retry attempts before giving up. Default: 3. */
  maxAttempts?: number;
  /** How long to keep showing "✓ Saved" before reverting to idle. Default: 3000ms. */
  successTimeoutMs?: number;
  /** Backoff delays between retries (ms). Default: [600, 1500]. Length should be maxAttempts - 1. */
  backoffMs?: number[];
  /** Optional callback after a successful save (e.g. router.refresh()). */
  onSuccess?: () => void | Promise<void>;
}

/**
 * Wraps a Next.js Server Action in retry-on-503 + visible status feedback.
 *
 * Why this exists: when a Server Action POST returns a 5xx, React resolves
 * the action's promise as if successful. The form thinks it saved but the
 * data wasn't persisted — silent corruption. We intercept `window.fetch`
 * during the action call to spy on the actual response status, throw if
 * it was 5xx, and retry with backoff. After all retries fail, the user
 * sees a real error instead of a fake success.
 *
 * Two ways to call:
 *
 * 1. **`submit(action, formData)`** — for forms whose server action takes a
 *    single `FormData` parameter (the common case for `<form onSubmit>`).
 *
 * 2. **`invoke(thunk)`** — for actions with typed arguments. Pass a closure
 *    that calls your action however you like. Use this for click-button
 *    actions like fulfill/refund/toggle.
 *
 * Both return the action's value (or `undefined` if all retries failed).
 *
 * Usage:
 *
 * ```tsx
 * const { status, submit, invoke, submitting } = useFormSave({
 *   onSuccess: () => router.refresh(),
 * });
 *
 * // Form submit:
 * await submit(myServerAction, formData);
 *
 * // Click handler:
 * await invoke(() => markFulfilledAction(redemptionId, note));
 * ```
 */
export function useFormSave(options: UseFormSaveOptions = {}) {
  const {
    path,
    maxAttempts = 3,
    successTimeoutMs = 3000,
    backoffMs = [600, 1500],
    onSuccess,
  } = options;
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  /**
   * Core retry+probe loop. Takes a thunk that performs the action however
   * the caller likes. Both `submit` and `invoke` delegate to this.
   */
  const invoke = useCallback(
    async function invokeAction<T>(
      thunk: () => Promise<T> | T,
    ): Promise<T | undefined> {
      const probePath =
        path ??
        (typeof window !== "undefined" ? window.location.pathname : "");
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        setStatus({ kind: "saving", attempt });
        try {
          const result = await callWithFetchProbe<T>(thunk, probePath);
          setStatus({ kind: "saved" });
          if (onSuccess) {
            try {
              await onSuccess();
            } catch {
              // onSuccess errors don't fail the save itself
            }
          }
          // Auto-clear the success toast after a moment
          setTimeout(() => {
            setStatus((s) => (s.kind === "saved" ? { kind: "idle" } : s));
          }, successTimeoutMs);
          return result;
        } catch (err) {
          lastError = err;
          if (attempt < maxAttempts) {
            const delay = backoffMs[attempt - 1] ?? 1500;
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }

      setStatus({
        kind: "error",
        message:
          lastError instanceof Error
            ? lastError.message
            : `Save failed after ${maxAttempts} attempts. Try again in a moment.`,
      });
      return undefined;
    },
    [path, maxAttempts, successTimeoutMs, backoffMs, onSuccess],
  );

  /**
   * Backward-compatible form-submit path. Equivalent to
   * `invoke(() => action(formData))`.
   */
  const submit = useCallback(
    function submitAction<T>(
      action: (formData: FormData) => Promise<T> | T,
      formData: FormData,
    ): Promise<T | undefined> {
      return invoke(() => action(formData));
    },
    [invoke],
  );

  return {
    status,
    submit,
    invoke,
    submitting: status.kind === "saving",
  };
}

/**
 * Run the thunk while monkey-patching window.fetch to spy on the actual
 * Server Action response status. If the POST returned ≥ 500, throw so the
 * retry loop picks it up. Returns whatever the thunk returned on success.
 */
async function callWithFetchProbe<T>(
  thunk: () => Promise<T> | T,
  pathHint: string,
): Promise<T> {
  let lastStatus: number | null = null;
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args as Parameters<typeof fetch>);
    const url = String(args[0] || "");
    // Server Actions POST to the page URL (without `?_rsc=…` which is the
    // RSC refetch that fires on success). Match by path-substring.
    if (
      pathHint &&
      url.includes(pathHint) &&
      !url.includes("?_rsc")
    ) {
      lastStatus = res.status;
    }
    return res;
  };
  try {
    const result = await thunk();
    if (lastStatus !== null && lastStatus >= 500) {
      throw new Error(`Server returned ${lastStatus}`);
    }
    return result;
  } finally {
    window.fetch = origFetch;
  }
}

/**
 * Drop-in status indicator for the four save states.
 * Pair with the result of useFormSave().
 */
export function SaveStatusIndicator({
  status,
  className = "text-xs",
}: {
  status: SaveStatus;
  className?: string;
}) {
  if (status.kind === "idle") return null;
  if (status.kind === "saving") {
    return (
      <span className={`${className} text-white/60`}>
        Saving{status.attempt > 1 ? ` — retrying (${status.attempt})` : "…"}
      </span>
    );
  }
  if (status.kind === "saved") {
    return <span className={`${className} text-emerald-300`}>✓ Saved</span>;
  }
  return (
    <span
      className={`${className} text-rose-300`}
      title={status.message}
    >
      ✗ {status.message}
    </span>
  );
}
