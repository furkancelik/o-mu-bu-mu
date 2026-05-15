"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { gql } from "@/lib/gql-client";

export function DeleteGameButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Bu oyunu ve tüm oylarını silmek istediğine emin misin?"))
          return;
        setBusy(true);
        try {
          await gql(`mutation($slug: String!){ deleteGame(slug:$slug) }`, {
            slug,
          });
          router.push("/admin");
          router.refresh();
        } catch {
          setBusy(false);
        }
      }}
      className="btn btn-ghost !px-3 !py-2 text-xs text-rose-300"
    >
      {busy ? "Siliniyor..." : "Oyunu sil"}
    </button>
  );
}
