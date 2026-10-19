"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
    >
      {copied ? "Copied ✓" : "Copy script"}
    </button>
  );
}
