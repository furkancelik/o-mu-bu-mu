"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gql-client";

type Uploaded = {
  url: string;
  fileName: string;
  width: number;
  height: number;
};

export function NewGameForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter((f) =>
      f.type.startsWith("image/")
    );
    setFiles((prev) => [...prev, ...arr]);
    setPreviewUrls((prev) => [
      ...prev,
      ...arr.map((f) => URL.createObjectURL(f)),
    ]);
  }, []);

  const removeAt = (i: number) => {
    setFiles((p) => p.filter((_, idx) => idx !== i));
    setPreviewUrls((p) => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, idx) => idx !== i);
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Başlık zorunlu");
      return;
    }
    if (files.length < 2) {
      setError("En az 2 resim eklemelisin");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upJson = await upRes.json();
      if (!upRes.ok) throw new Error(upJson.error ?? "Yükleme hatası");
      const images: Uploaded[] = upJson.images;

      const data = await gql<{ createGame: { slug: string } }>(
        `
        mutation Create($title: String!, $description: String, $images: [ImageInput!]!) {
          createGame(title: $title, description: $description, images: $images) {
            slug
          }
        }
      `,
        {
          title: title.trim(),
          description: description.trim() || null,
          images,
        }
      );
      router.push(`/admin/${data.createGame.slug}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Yeni oyun
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Başlık ver, resimleri sürükle bırak, oluştur.
      </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm text-zinc-300">Başlık</label>
            <input
              type="text"
              className="input mt-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: En sevdiğin kahvaltı"
              maxLength={140}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-300">
              Açıklama (opsiyonel)
            </label>
            <textarea
              className="input mt-2 min-h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={600}
              placeholder="Kısa bir not, oylayanların görmesi için."
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-300">Resimler</label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInput.current?.click()}
              className={`mt-2 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
                dragging
                  ? "border-[var(--accent-2)] bg-[var(--muted)]"
                  : "border-[var(--border)] bg-[var(--muted)]/40 hover:bg-[var(--muted)]"
              }`}
            >
              <p className="text-sm text-zinc-300">
                Sürükle bırak ya da tıkla — birden çok resim seçebilirsin
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                JPG / PNG / WEBP / GIF · 10 MB&apos;a kadar
              </p>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/*"
                hidden
                onChange={(e) =>
                  e.target.files && addFiles(e.target.files)
                }
              />
            </div>

            {previewUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {previewUrls.map((src, i) => (
                  <div
                    key={src}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-black"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      className="absolute right-1 top-1 rounded-md bg-black/70 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
                    >
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-700/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? "Oluşturuluyor..." : "Oyunu oluştur"}
            </button>
          </div>
        </form>
    </main>
  );
}
