"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { gql } from "@/lib/gql-client";
import { Lightbox } from "@/components/Lightbox";

type GameImage = {
  id: string;
  url: string;
  fileName: string;
};

type SessionState = {
  sessionKey: string;
  gameSlug: string;
  phase: "discovery" | "ranking" | "final" | "done";
  round: number;
  totalRoundsEstimate: number;
  pair: { a: GameImage; b: GameImage } | null;
  finished: boolean;
  winner: GameImage | null;
};

const phaseLabels: Record<SessionState["phase"], string> = {
  discovery: "Keşif",
  ranking: "Sıralama",
  final: "Final",
  done: "Bitti",
};

function storageKey(slug: string) {
  return `omubumu:session:${slug}`;
}

export function PlayClient({
  slug,
  title,
  description,
}: {
  slug: string;
  title: string;
  description: string | null;
}) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lightbox, setLightbox] = useState<GameImage | null>(null);

  const persistKey = useCallback(
    (key: string) => {
      try {
        localStorage.setItem(storageKey(slug), key);
      } catch {
        /* noop */
      }
    },
    [slug]
  );

  const clearKey = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(slug));
    } catch {
      /* noop */
    }
  }, [slug]);

  const startFresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gql<{ startSession: SessionState }>(
        `mutation($slug: String!) {
          startSession(slug: $slug) {
            sessionKey gameSlug phase round totalRoundsEstimate finished
            pair { a { id url fileName } b { id url fileName } }
            winner { id url fileName }
          }
        }`,
        { slug }
      );
      persistKey(data.startSession.sessionKey);
      setSession(data.startSession);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error && e.message ? e.message : "Oturum başlatılamadı"
      );
    } finally {
      setLoading(false);
    }
  }, [slug, persistKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing =
        typeof window !== "undefined"
          ? localStorage.getItem(storageKey(slug))
          : null;
      if (!existing) {
        if (!cancelled) await startFresh();
        return;
      }
      try {
        const data = await gql<{ session: SessionState | null }>(
          `query($key: String!) {
            session(sessionKey: $key) {
              sessionKey gameSlug phase round totalRoundsEstimate finished
              pair { a { id url fileName } b { id url fileName } }
              winner { id url fileName }
            }
          }`,
          { key: existing }
        );
        if (cancelled) return;
        if (!data.session || data.session.finished) {
          if (data.session?.finished) {
            router.replace(
              `/play/${slug}/result?key=${data.session.sessionKey}`
            );
            return;
          }
          await startFresh();
        } else {
          setSession(data.session);
          setLoading(false);
        }
      } catch {
        if (!cancelled) await startFresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, startFresh, router]);

  const pick = async (winnerId: string, loserId: string) => {
    if (!session || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await gql<{ submitVote: SessionState }>(
        `mutation($key:String!,$w:ID!,$l:ID!){
          submitVote(sessionKey:$key, winnerImageId:$w, loserImageId:$l){
            sessionKey gameSlug phase round totalRoundsEstimate finished
            pair { a { id url fileName } b { id url fileName } }
            winner { id url fileName }
          }
        }`,
        { key: session.sessionKey, w: winnerId, l: loserId }
      );
      const next = data.submitVote;
      setSession(next);
      if (next.finished) {
        clearKey();
        router.replace(`/play/${slug}/result?key=${next.sessionKey}`);
      }
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error && e.message ? e.message : "Oy gönderilemedi"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-20 sm:px-6">
        <div className="text-zinc-400">Oturum hazırlanıyor...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-20 sm:px-6">
        <div className="card max-w-md p-6 text-center">
          <p className="text-rose-300">{error}</p>
          <button onClick={startFresh} className="btn btn-primary mt-4">
            Yeniden başla
          </button>
        </div>
      </main>
    );
  }

  if (!session || !session.pair) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-20 sm:px-6">
        <div className="text-zinc-400">Eşleşme bulunamadı.</div>
      </main>
    );
  }

  const { a, b } = session.pair;
  const progress = Math.min(
    100,
    Math.round((session.round / Math.max(1, session.totalRoundsEstimate)) * 100)
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="line-clamp-1 text-lg font-semibold sm:text-2xl">
            {title}
          </h1>
          <div className="shrink-0 text-xs text-zinc-400 sm:text-sm">
            Tur {session.round + 1} ·{" "}
            <span className="text-zinc-300">{phaseLabels[session.phase]}</span>
          </div>
        </div>
        {description && (
          <p className="text-sm text-zinc-400">{description}</p>
        )}
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
          <div
            className="h-full bg-gradient-to-r from-rose-400 to-indigo-400 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="relative mt-5 flex flex-1 flex-col items-stretch gap-3 sm:flex-row sm:gap-4">
        <AnimatePresence mode="popLayout">
          <ChoiceCard
            key={`${session.round}-a`}
            image={a}
            side="left"
            onPick={() => pick(a.id, b.id)}
            onZoom={() => setLightbox(a)}
            disabled={submitting}
          />
          <VSBadge />
          <ChoiceCard
            key={`${session.round}-b`}
            image={b}
            side="right"
            onPick={() => pick(b.id, a.id)}
            onZoom={() => setLightbox(b)}
            disabled={submitting}
          />
        </AnimatePresence>
      </div>

      <p className="mt-4 text-center text-xs text-zinc-500">
        Resme dokunarak büyütebilir, &quot;Bunu seç&quot;e basarak oy
        verebilirsin.
      </p>

      {lightbox && (
        <Lightbox image={lightbox} onClose={() => setLightbox(null)} />
      )}
    </main>
  );
}

function ChoiceCard({
  image,
  side,
  onPick,
  onZoom,
  disabled,
}: {
  image: GameImage;
  side: "left" | "right";
  onPick: () => void;
  onZoom: () => void;
  disabled: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -40 : 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="card group relative flex flex-1 flex-col overflow-hidden"
    >
      <button
        type="button"
        onClick={onZoom}
        className="relative block aspect-[4/5] w-full overflow-hidden bg-black sm:aspect-auto sm:flex-1"
        aria-label="Resmi büyüt"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.fileName}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/50 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-200">
          büyüt
        </span>
      </button>
      <div className="p-3">
        <button
          type="button"
          onClick={onPick}
          disabled={disabled}
          className="btn btn-primary w-full"
        >
          Bunu seç
        </button>
      </div>
    </motion.div>
  );
}

function VSBadge() {
  return (
    <div className="pointer-events-none relative z-10 flex items-center justify-center sm:absolute sm:inset-y-0 sm:left-1/2 sm:-translate-x-1/2">
      <div className="rounded-full border border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-sm font-bold tracking-widest text-zinc-300 shadow-xl">
        VS
      </div>
    </div>
  );
}
