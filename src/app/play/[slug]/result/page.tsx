import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { getSessionState } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { slug } = await params;
  const { key } = await searchParams;
  if (!key) return notFound();
  const session = await getSessionState(key);
  if (!session) return notFound();

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-10 sm:px-6">
        <span className="rounded-full border border-[var(--border)] bg-[var(--muted)]/60 px-3 py-1 text-xs uppercase tracking-widest text-zinc-400">
          turnuva tamamlandı
        </span>
        <h1 className="mt-4 text-center text-3xl font-semibold tracking-tight sm:text-5xl">
          <span className="bg-gradient-to-r from-rose-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
            Senin galibin
          </span>
        </h1>

        {session.winner ? (
          <div className="card mt-8 w-full max-w-md overflow-hidden">
            <div className="aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={session.winner.url}
                alt={session.winner.fileName}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-4 text-center text-sm text-zinc-300">
              {session.winner.fileName}
            </div>
          </div>
        ) : (
          <p className="mt-8 text-zinc-400">Galip seçilemedi.</p>
        )}

        <p className="mt-6 text-sm text-zinc-400">
          {session.round} tur oynadın.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={`/play/${slug}`} className="btn btn-primary">
            Tekrar oyna
          </Link>
          <Link href="/" className="btn btn-ghost">
            Ana sayfa
          </Link>
        </div>
      </main>
    </>
  );
}
