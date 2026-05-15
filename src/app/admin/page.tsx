import Link from "next/link";
import { Header } from "@/components/Header";
import { listGames } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const games = await listGames();

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Oyunlar
          </h1>
          <Link href="/admin/new" className="btn btn-primary !px-4 !py-2 text-sm">
            Yeni oyun
          </Link>
        </div>

        {games.length === 0 ? (
          <div className="card mt-10 flex flex-col items-center px-6 py-16 text-center">
            <p className="text-zinc-400">Henüz oyun yok.</p>
            <Link href="/admin/new" className="btn btn-primary mt-6">
              İlk oyunu oluştur
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => (
              <Link
                key={g.id}
                href={`/admin/${g.slug}`}
                className="card group flex flex-col overflow-hidden hover:border-[var(--accent-2)]"
              >
                <div className="grid aspect-[16/9] grid-cols-2 gap-px bg-black">
                  {g.images.slice(0, 2).map((i) => (
                    <div
                      key={i.id}
                      className="bg-cover bg-center"
                      style={{ backgroundImage: `url(${i.url})` }}
                    />
                  ))}
                  {g.images.length < 2 && (
                    <div className="col-span-2 flex items-center justify-center bg-[var(--muted)] text-xs text-zinc-500">
                      resim yok
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="line-clamp-1 font-medium">{g.title}</h3>
                  {g.description && (
                    <p className="line-clamp-2 text-sm text-zinc-400">
                      {g.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between text-xs text-zinc-500">
                    <span>{g.images.length} resim</span>
                    <span>
                      {g.totalSessions} oturum · {g.totalVotes} oy
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
