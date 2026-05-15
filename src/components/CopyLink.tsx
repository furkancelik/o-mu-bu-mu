"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* noop */
        }
      }}
      className="btn btn-ghost !px-3 !py-2 text-xs"
    >
      {copied ? "Kopyalandı" : "Linki kopyala"}
    </button>
  );
}
