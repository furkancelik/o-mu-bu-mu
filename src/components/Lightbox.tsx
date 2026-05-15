"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Lightbox({
  image,
  onClose,
}: {
  image: { url: string; fileName: string };
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative max-h-[92vh] max-w-[92vw]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.fileName}
            className="max-h-[92vh] max-w-[92vw] rounded-xl object-contain"
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--muted)] text-white shadow-xl hover:bg-black"
            aria-label="Kapat"
          >
            ×
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
