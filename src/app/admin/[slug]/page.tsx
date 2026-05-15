import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { getAnalytics, getGameBySlug } from "@/lib/data";
import { CopyLink } from "@/components/CopyLink";
import { DeleteGameButton } from "@/components/DeleteGameButton";
import { GameEditor } from "@/components/GameEditor";

export const dynamic = "force-dynamic";

export default async function GameAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [game, analytics] = await Promise.all([
    getGameBySlug(slug),
    getAnalytics(slug),
  ]);
  if (!game) return notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const shareUrl = `${proto}://${host}/play/${game.slug}`;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin"
              className="text-sm text-zinc-400 hover:text-white"
            >
              ← Tüm oyunlar
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {game.title}
            </h1>
            {game.description && (
              <p className="mt-1 text-sm text-zinc-400">{game.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/play/${game.slug}`}
              target="_blank"
              className="btn btn-ghost !px-3 !py-2 text-xs"
            >
              Oyna
            </Link>
            <CopyLink url={shareUrl} />
            <DeleteGameButton slug={game.slug} />
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/50 px-4 py-3 text-sm text-zinc-300 break-all">
          Paylaşım linki:{" "}
          <span className="font-mono text-zinc-100">{shareUrl}</span>
        </div>

        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Toplam oturum" value={analytics?.totalSessions ?? 0} />
          <Stat
            label="Biten oturum"
            value={analytics?.finishedSessions ?? 0}
          />
          <Stat label="Toplam oy" value={analytics?.totalVotes ?? 0} />
          <Stat
            label="Oturum başı oy"
            value={(analytics?.avgVotesPerSession ?? 0).toFixed(1)}
          />
        </section>

        <div className="mt-10">
          <GameEditor
            slug={game.slug}
            initialTitle={game.title}
            initialDescription={game.description}
            initialImages={game.images.map((i) => ({
              id: i.id,
              url: i.url,
              fileName: i.fileName,
              wins: i.wins,
              losses: i.losses,
              appearances: i.appearances,
              elo: i.elo,
            }))}
          />
        </div>

        <section className="mt-12">
          <h2 className="text-lg font-medium">Lider tablosu (Elo)</h2>
          <p className="text-sm text-zinc-400">
            Tüm oturumlardaki seçimlere göre hesaplanan Elo puanı.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {analytics?.leaderboard.map((s, i) => (
              <div
                key={s.image.id}
                className="card flex items-center gap-3 p-3"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--muted)] text-sm font-semibold text-zinc-300">
                  #{i + 1}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.image.url}
                  alt={s.image.fileName}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm text-zinc-300">
                      {s.image.fileName}
                    </span>
                    <span className="shrink-0 font-mono text-sm text-zinc-100">
                      {Math.round(s.image.elo)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {s.voteWins}G / {s.voteLosses}M · {s.appearances} görünme ·
                    final {s.sessionWins}x
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
                    <div
                      className="h-full bg-gradient-to-r from-rose-400 to-indigo-400"
                      style={{
                        width: `${Math.round(s.winRate * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium">En çok kazanan resimler</h2>
          <p className="text-sm text-zinc-400">
            Oturumların sonunda final galibi olan resimler.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {analytics?.finalWinnerCounts.slice(0, 8).map((s) => (
              <div key={s.image.id} className="card overflow-hidden">
                <div className="aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.image.url}
                    alt={s.image.fileName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="px-3 py-2">
                  <div className="text-xs text-zinc-500">final galibi</div>
                  <div className="text-lg font-semibold">{s.sessionWins}x</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="card px-4 py-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
