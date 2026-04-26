"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormSave, SaveStatusIndicator } from "@/lib/use-form-save";

/**
 * Click button that fires a server action with the given hidden fields.
 * Wraps the call in useFormSave so each click gets retry-on-503 + visible
 * status, instead of silently failing (which is what happened with the
 * original `<form action={fn}>` pattern when Vercel cold-started).
 *
 * Server actions are passed as props from server components to client
 * components via the standard Next.js "client function ref" mechanism.
 *
 * Variants give you the common pin/delete styling. For anything bespoke
 * (suspend/unsuspend toggles, etc.), pass `className` to override.
 */
export default function ModerationButton({
  action,
  fields,
  label,
  variant = "default",
  className,
  confirmMessage,
}: {
  action: (formData: FormData) => Promise<unknown> | unknown;
  fields: Record<string, string>;
  label: string;
  variant?: "default" | "delete";
  /** Override the default styling. Wins over `variant`. */
  className?: string;
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [bizError, setBizError] = useState<string | null>(null);
  const { status, invoke, submitting } = useFormSave({
    onSuccess: () => router.refresh(),
  });

  async function handleClick() {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setBizError(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      fd.set(k, v);
    }
    const result = await invoke<unknown>(() => action(fd));
    if (
      result &&
      typeof result === "object" &&
      "error" in result &&
      typeof (result as { error: unknown }).error === "string"
    ) {
      setBizError((result as { error: string }).error);
    }
  }

  const baseClassName =
    className ??
    (variant === "delete"
      ? "text-[11px] text-rose-300/80 hover:text-rose-300 disabled:opacity-50"
      : "text-[11px] text-white/60 hover:text-white disabled:opacity-50");

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className={baseClassName}
      >
        {submitting ? "…" : label}
      </button>
      <SaveStatusIndicator status={status} className="text-[10px]" />
      {bizError && (
        <span
          className="text-[10px] text-rose-300"
          title={bizError}
        >
          ✗
        </span>
      )}
    </span>
  );
}
