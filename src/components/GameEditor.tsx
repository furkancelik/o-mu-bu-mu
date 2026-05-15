"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { gql } from "@/lib/gql-client";
import { Lightbox } from "@/components/Lightbox";

type GameImage = {
  id: string;
  url: string;
  fileName: string;
  wins: number;
  losses: number;
  appearances: number;
  elo: number;
};

type Props = {
  slug: string;
  initialTitle: string;
  initialDescription: string | null;
  initialImages: GameImage[];
};

export function GameEditor({
  slug,
  initialTitle,
  initialDescription,
  initialImages,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [images, setImages] = useState<GameImage[]>(initialImages);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaMsg, setMetaMsg] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<GameImage | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const metaDirty =
    title.trim() !== initialTitle ||
    (description.trim() || null) !== (initialDescription ?? null);

  const saveMeta = async () => {
    if (!metaDirty) return;
    if (!title.trim()) {
      setMetaMsg({ kind: "err", text: "Başlık boş olamaz" });
      return;
    }
    setSavingMeta(true);
    setMetaMsg(null);
    try {
      await gql(
        `mutation($slug:String!,$title:String,$description:String){
          updateGame(slug:$slug,title:$title,description:$description){ id title description }
        }`,
        {
          slug,
          title: title.trim(),
          description: description.trim() || null,
        }
      );
      setMetaMsg({ kind: "ok", text: "Kaydedildi" });
      router.refresh();
    } catch (e) {
      setMetaMsg({
        kind: "err",
        text: e instanceof Error ? e.message : "Hata",
      });
    } finally {
      setSavingMeta(false);
    }
  };

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (arr.length === 0) return;
      setUploading(true);
      setUploadError(null);
      try {
        const fd = new FormData();
        for (const f of arr) fd.append("files", f);
        const upRes = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });
        const upJson = await upRes.json();
        if (!upRes.ok) throw new Error(upJson.error ?? "Yükleme hatası");

        const data = await gql<{
          addImages: { images: GameImage[] };
        }>(
          `mutation($slug:String!,$images:[ImageInput!]!){
            addImages(slug:$slug, images:$images){
              images { id url fileName wins losses appearances elo }
            }
          }`,
          { slug, images: upJson.images }
        );
        setImages(data.addImages.images);
        router.refresh();
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "Hata");
      } finally {
        setUploading(false);
      }
    },
    [slug, router]
  );

  const deleteImage = async (id: string) => {
    if (images.length <= 2) {
      alert("Oyunda en az 2 resim kalmalı. Önce yeni resim ekle.");
      return;
    }
    if (!confirm("Bu resmi ve ilgili oyları silmek istediğine emin misin?"))
      return;
    setBusyImageId(id);
    try {
      const data = await gql<{
        deleteImage: { images: GameImage[] };
      }>(
        `mutation($slug:String!,$id:ID!){
          deleteImage(slug:$slug, imageId:$id){
            images { id url fileName wins losses appearances elo }
          }
        }`,
        { slug, id }
      );
      setImages(data.deleteImage.images);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error && e.message ? e.message : "Silinemedi");
    } finally {
      setBusyImageId(null);
    }
  };

  return (
    <div className="space-y-10">
      <section className="card p-5">
        <h2 className="text-lg font-medium">Oyun bilgileri</h2>
        <p className="text-sm text-zinc-400">
          Başlık ve açıklama paylaşım sayfasında ve panelde görünür.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500">
              Başlık
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input mt-2"
              maxLength={140}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500">
              Açıklama
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input mt-2 min-h-12"
              maxLength={600}
              rows={2}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={saveMeta}
            disabled={!metaDirty || savingMeta}
            className="btn btn-primary !px-4 !py-2 text-sm"
          >
            {savingMeta ? "Kaydediliyor..." : "Kaydet"}
          </button>
          {metaDirty && (
            <button
              type="button"
              onClick={() => {
                setTitle(initialTitle);
                setDescription(initialDescription ?? "");
                setMetaMsg(null);
              }}
              className="btn btn-ghost !px-4 !py-2 text-sm"
            >
              Geri al
            </button>
          )}
          {metaMsg && (
            <span
              className={`text-sm ${
                metaMsg.kind === "ok" ? "text-emerald-400" : "text-rose-300"
              }`}
            >
              {metaMsg.text}
            </span>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-medium">Resimler ({images.length})</h2>
            <p className="text-sm text-zinc-400">
              Yeni resim ekle, eski resmi sil. Silinen resim ile birlikte o
              resmi içeren tüm oylar temizlenir.
            </p>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void uploadFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInput.current?.click()}
          className={`mt-4 cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${
            dragging
              ? "border-[var(--accent-2)] bg-[var(--muted)]"
              : "border-[var(--border)] bg-[var(--muted)]/40 hover:bg-[var(--muted)]"
          } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
        >
          <p className="text-sm text-zinc-300">
            {uploading
              ? "Yükleniyor..."
              : "Yeni resim için sürükle bırak ya da tıkla"}
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
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {uploadError && (
          <p className="mt-3 text-sm text-rose-300">{uploadError}</p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {images.map((img) => (
              <motion.div
                key={img.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.18 }}
                className="card group relative overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setLightbox(img)}
                  className="block aspect-square w-full bg-black"
                  aria-label="Büyüt"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.fileName}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                </button>
                <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-zinc-400">
                  <span className="truncate" title={img.fileName}>
                    {img.fileName}
                  </span>
                  <span className="shrink-0 font-mono text-zinc-300">
                    {Math.round(img.elo)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                  <span>
                    {img.wins}G / {img.losses}M
                  </span>
                  <button
                    type="button"
                    disabled={busyImageId === img.id || images.length <= 2}
                    onClick={() => deleteImage(img.id)}
                    className="rounded-md px-2 py-1 text-rose-300 hover:bg-rose-950/40 disabled:opacity-40"
                  >
                    {busyImageId === img.id ? "siliniyor" : "sil"}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {images.length <= 2 && (
          <p className="mt-3 text-xs text-zinc-500">
            Oyunun çalışabilmesi için en az 2 resim gerekli — bu yüzden son 2
            resmi silemezsin.
          </p>
        )}
      </section>

      {lightbox && (
        <Lightbox image={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
