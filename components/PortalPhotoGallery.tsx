"use client";

import { useState } from "react";

interface Photo {
  id: string;
  url: string;
  category: string;
}

const CATEGORY_ORDER = ["before", "during", "after", "damages"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  before:  "Before",
  during:  "During",
  after:   "After",
  damages: "Damages",
};

export default function PortalPhotoGallery({ photos }: { photos: Photo[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  const grouped = CATEGORY_ORDER.reduce<Record<string, Photo[]>>((acc, cat) => {
    const group = photos.filter((p) => p.category === cat);
    if (group.length > 0) acc[cat] = group;
    return acc;
  }, {});

  if (Object.keys(grouped).length === 0) return null;

  return (
    <>
      <div className="mb-5">
        <h2 className="text-white font-bold text-lg mb-3">Photos</h2>
        <div className="flex flex-col gap-5">
          {CATEGORY_ORDER.filter((cat) => grouped[cat]).map((cat) => (
            <div key={cat}>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
                {CATEGORY_LABELS[cat]}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {grouped[cat].map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setLightbox(photo.url)}
                    className="relative aspect-square rounded-xl overflow-hidden bg-[#1A1A1A] active:opacity-80 transition-opacity"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-black/60 flex items-center justify-center text-white text-2xl leading-none active:scale-95"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
