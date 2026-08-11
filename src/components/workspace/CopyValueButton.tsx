"use client";

import { useState } from "react";

export function CopyValueButton({
  value,
  label,
}: {
  value?: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const disabled = !value;

  async function copyValue() {
    if (!value) {
      return;
    }
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void copyValue()}
      aria-label={`複製${label}`}
      className="rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {copied ? "已複製" : "複製 ID"}
    </button>
  );
}
