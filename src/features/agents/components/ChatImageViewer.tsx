"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { Download, X } from "lucide-react";

// ── Inline Image ───────────────────────────────────────────────────────

export const InlineChatImage = memo(function InlineChatImage({
  src,
  alt,
}: {
  src: string;
  alt?: string;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  if (broken) return null;

  return (
    <>
      <button
        type="button"
        className="mt-2 block overflow-hidden rounded-lg border border-border/50 shadow-sm transition-transform hover:scale-[1.02]"
        onClick={() => setLightboxOpen(true)}
        aria-label="View full image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? "Attached image"}
          className="max-w-[240px] cursor-zoom-in object-contain sm:max-w-[320px]"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      </button>
      {lightboxOpen && (
        <ImageLightbox
          src={src}
          alt={alt}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
});

// ── Lightbox ───────────────────────────────────────────────────────────

const ImageLightbox = memo(function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = src;
    a.download = alt ?? "image";
    a.click();
  }, [src, alt]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Controls */}
      <div className="absolute right-4 top-4 flex gap-2 z-[201]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Download image"
        >
          <Download className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Close viewer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? "Full size image"}
        className="max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
});
