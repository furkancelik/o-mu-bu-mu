"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/admin/login");
        router.refresh();
      }}
      className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-[var(--muted)] hover:text-white disabled:opacity-50"
    >
      {busy ? "Çıkılıyor..." : "Çıkış"}
    </button>
  );
}
