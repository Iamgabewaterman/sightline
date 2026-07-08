"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import dynamic from "next/dynamic";
const PhotoMarkupEditor = dynamic(() => import("@/components/PhotoMarkupEditor"), { ssr: false });

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

export default function PortalPhotoGallery({
  photos,
  jobNumber,
  jobName,
  contractorUserId,
  jobId,
}: {
  photos: Photo[];
  jobNumber?: string | null;
  jobName?: string;
  contractorUserId?: string;
  jobId?: string;
}) {
  const grouped = CATEGORY_ORDER.reduce<Record<string, Photo[]>>((acc, cat) => {
    const group = photos.filter((p) => p.category === cat);
    if (group.length > 0) acc[cat] = group;
    return acc;
  }, {});

  const activeCats = CATEGORY_ORDER.filter((cat) => !!grouped[cat]);

  const [activeTab, setActiveTab]     = useState<string>(() => activeCats[0] ?? "before");
  const [lightbox,  setLightbox]      = useState<string | null>(null);
  const [isContractor, setIsContractor] = useState(false);
  const [markupFile,   setMarkupFile]   = useState<File | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Check if the viewer is the job owner
  useEffect(() => {
    if (!contractorUserId) return;
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user?.id === contractorUserId) setIsContractor(true);
      });
  }, [contractorUserId]);

  async function handleMarkupDone(file: File) {
    setMarkupFile(null);
    if (!jobId) return;
    setUploading(true);
    try {
      const supabase  = createClient();
      const compressed = await compressImage(file);
      const path = `${jobId}/during/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("job-photos")
        .upload(path, compressed, { contentType: "image/jpeg" });
      if (!upErr) {
        await supabase.from("photos").insert({
          job_id:      jobId,
          category:    "during",
          storage_path: path,
          taken_at:    new Date().toISOString(),
          job_number:  jobNumber ?? null,
        });
        window.location.reload();
      }
    } finally {
      setUploading(false);
    }
  }

  if (activeCats.length === 0) return null;

  const visiblePhotos = grouped[activeTab] ?? [];

  return (
    <>
      {markupFile && <PhotoMarkupEditor file={markupFile} onDone={handleMarkupDone} />}

      {/* Hidden camera input */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setMarkupFile(f);
          if (cameraRef.current) cameraRef.current.value = "";
        }}
      />

      <div className="mb-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-white font-bold text-lg">Photos</h2>
            {(jobNumber || jobName) && (
              <span className="text-gray-500 text-sm font-mono">
                {jobNumber ? `#${jobNumber}` : jobName}
              </span>
            )}
          </div>

          {/* Contractor-only camera button */}
          {isContractor && (
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={uploading}
              aria-label="Add photo"
              className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 active:scale-95 transition-transform disabled:opacity-50"
            >
              {uploading ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
                  <path d="M12 2a10 10 0 0 1 10 10"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Category tabs — only shown when more than one category has photos */}
        {activeCats.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {activeCats.map((cat) => {
              const count  = grouped[cat].length;
              const active = activeTab === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors active:scale-95 ${
                    active
                      ? "bg-orange-500 text-white"
                      : "bg-[#1A1A1A] text-gray-400 border border-[#2a2a2a]"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    active ? "bg-white/20 text-white" : "bg-[#242424] text-gray-500"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Single-category label */}
        {activeCats.length === 1 && (
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">
            {CATEGORY_LABELS[activeCats[0]]}
            <span className="ml-2 normal-case tracking-normal text-gray-600">{grouped[activeCats[0]].length}</span>
          </p>
        )}

        {/* Photo grid */}
        <div className="grid grid-cols-3 gap-1.5">
          {visiblePhotos.map((photo) => (
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
              {jobNumber && (
                <div className="absolute bottom-1 left-1">
                  <span className="bg-black/75 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none tracking-wide">
                    #{jobNumber}
                  </span>
                </div>
              )}
            </button>
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
