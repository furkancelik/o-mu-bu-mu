import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { getGameBySlug } from "@/lib/data";
import { PlayClient } from "./PlayClient";

export const dynamic = "force-dynamic";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return notFound();

  if (game.images.length < 2) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-20 text-center sm:px-6">
          <h1 className="text-2xl font-semibold">{game.title}</h1>
          <p className="mt-4 text-zinc-400">
            Bu oyun henüz hazır değil — en az 2 resim eklenmesi gerekiyor.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <PlayClient
        slug={game.slug}
        title={game.title}
        description={game.description}
      />
    </>
  );
}
