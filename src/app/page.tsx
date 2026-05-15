import Link from "next/link";
import { Header } from "@/components/Header";
import { listGames } from "@/lib/data";
import { getAdminFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [games, isAdmin] = await Promise.all([
    listGames(),
    getAdminFromCookies(),
  ]);
  const playable = games.filter((g) => g.images.length >= 2);

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
        <section className="flex flex-col items-center text-center">
          <span className="rounded-full border border-[var(--border)] bg-[var(--muted)]/60 px-3 py-1 text-xs uppercase tracking-widest text-zinc-400">
            ikili görsel oylama
          </span>
          <h1 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-rose-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
              O mu, bu mu?
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-zinc-300">
            Bir oyun seç, eşleşmelere oy ver, kendi galibini bul.
          </p>
        </section>

        <section className="mt-12">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-medium sm:text-xl">Oyunlar</h2>
            <span className="text-sm text-zinc-500">
              {playable.length} oyun
            </span>
          </div>

          {playable.length === 0 ? (
            <div className="card mt-6 flex flex-col items-center px-6 py-16 text-center">
              <p className="text-zinc-400">
                Henüz oynanabilecek bir oyun yok.
              </p>
              {isAdmin ? (
                <Link href="/admin/new" className="btn btn-primary mt-6">
                  İlk oyunu oluştur
                </Link>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">
                  Yöneticinin yeni bir oyun eklemesini bekle.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {playable.map((g) => (
                <div
                  key={g.id}
                  className="card group flex flex-col overflow-hidden"
                >
                  <Link
                    href={`/play/${g.slug}`}
                    className="block"
                    aria-label={`${g.title} oyununu oyna`}
                  >
                    <div className="grid aspect-[16/9] grid-cols-2 gap-px bg-black">
                      {g.images.slice(0, 2).map((i) => (
                        <div
                          key={i.id}
                          className="bg-cover bg-center transition group-hover:scale-[1.02]"
                          style={{ backgroundImage: `url(${i.url})` }}
                        />
                      ))}
                    </div>
                  </Link>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <h3 className="line-clamp-1 font-medium">{g.title}</h3>
                      {g.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                          {g.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                      <span>{g.images.length} resim</span>
                      <span>{g.totalSessions} oturum</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Link
                        href={`/play/${g.slug}`}
                        className="btn btn-primary !px-4 !py-2 text-sm"
                      >
                        Oyna
                      </Link>
                      {isAdmin && (
                        <Link
                          href={`/admin/${g.slug}`}
                          className="btn btn-ghost !px-4 !py-2 text-sm"
                        >
                          Detaylar
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {!isAdmin && (
          <section className="mt-16 grid grid-cols-1 gap-4 text-sm text-zinc-400 sm:grid-cols-3">
            <Feature title="Eşleşmelere oy ver">
              İki resim yan yana gelir, sen seçersin. Resme dokunarak büyütüp
              detayına bakabilirsin.
            </Feature>
            <Feature title="Akıllı algoritma">
              Bütün resimleri adil şekilde gösterir, sonra seçimlerine göre
              daraltarak senin galibini bulur.
            </Feature>
            <Feature title="Kendi turnuvan">
              Her kullanıcı kendi oturumunu oynar; başkasının seçimi seninkini
              etkilemez.
            </Feature>
          </section>
        )}
      </main>
    </>
  );
}

function Feature({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <h3 className="text-base font-medium text-zinc-100">{title}</h3>
      <p className="mt-1 text-sm text-zinc-400">{children}</p>
    </div>
  );
}
