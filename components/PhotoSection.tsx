"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Photo, PhotoCategory } from "@/types";
import { compressImage } from "@/lib/compress-image";
import { deletePhoto } from "@/app/actions/photos";

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

const CATEGORIES: { value: PhotoCategory; label: string }[] = [
  { value: "before",  label: "Before"  },
  { value: "during",  label: "During"  },
  { value: "after",   label: "After"   },
  { value: "damages", label: "Damages" },
];

async function getLocation(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      ()    => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    + " · " + new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

interface Props {
  jobId: string;
  initialPhotos: Photo[];
}

export default function PhotoSection({ jobId, initialPhotos }: Props) {
  const [activeCategory, setActiveCategory] = useState<PhotoCategory>("before");
  const [photos,         setPhotos]         = useState<Photo[]>(initialPhotos);
  const [uploading,      setUploading]      = useState(false);
  const [error,          setError]          = useState("");
  const [detail,         setDetail]         = useState<Photo | null>(null);
  const [confirmDeleteId,setConfirmDeleteId]= useState<string | null>(null);
  const [deleting,       setDeleting]       = useState(false);

  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const getPublicUrl = useCallback(
    (path: string) => supabase.storage.from("job-photos").getPublicUrl(path).data.publicUrl,
    [supabase]
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");

    // Capture location once for the whole batch (silent)
    const takenAt = new Date().toISOString();
    const loc = await getLocation();

    const errors: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImage(file);
        const path = `${jobId}/${activeCategory}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("job-photos")
          .upload(path, compressed, { contentType: "image/jpeg" });

        if (uploadError) { errors.push(uploadError.message); continue; }

        const insert: Record<string, unknown> = {
          job_id: jobId,
          category: activeCategory,
          storage_path: path,
          taken_at: takenAt,
          lat: loc?.lat ?? null,
          lng: loc?.lng ?? null,
          accuracy: loc?.accuracy ?? null,
        };

        const { data: photo, error: dbError } = await supabase
          .from("photos")
          .insert(insert)
          .select()
          .single<Photo>();

        if (dbError) { errors.push(dbError.message); }
        else if (photo) { setPhotos((prev) => [photo, ...prev]); }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "Upload failed");
      }
    }

    if (errors.length > 0) setError(errors.join(" · "));
    setUploading(false);
    if (cameraInputRef.current)  cameraInputRef.current.value  = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  async function handleDeleteConfirmed() {
    if (!confirmDeleteId) return;
    const photo = photos.find((p) => p.id === confirmDeleteId);
    if (!photo) return;
    setDeleting(true);
    await deletePhoto(photo.id, photo.storage_path);
    setPhotos((prev) => prev.filter((p) => p.id !== confirmDeleteId));
    if (detail?.id === confirmDeleteId) setDetail(null);
    setConfirmDeleteId(null);
    setDeleting(false);
  }

  const visiblePhotos = photos.filter((p) => p.category === activeCategory);

  return (
    <div className="mt-8">
      <h2 className="text-white font-bold text-xl mb-4">Photos</h2>

      {/* Category tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveCategory(value)}
            className={`shrink-0 px-4 py-3 rounded-xl font-semibold text-sm transition-colors active:scale-95 ${
              activeCategory === value
                ? "bg-orange-500 text-white"
                : "bg-[#1A1A1A] text-gray-400 border border-[#2a2a2a]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Upload buttons */}
      <div className="flex gap-3 mb-5">
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          <span className="text-xl">📷</span> Take Photo
        </button>
        <button
          onClick={() => galleryInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          <span className="text-xl">🖼️</span> Upload Photo
        </button>
      </div>

      {/* Hidden inputs */}
      <input ref={cameraInputRef}  type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      <input ref={galleryInputRef} type="file" accept="image/*"                       multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

      {uploading && <p className="text-gray-400 text-sm mb-4 animate-pulse">Compressing and uploading...</p>}
      {error     && <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {/* Photo grid */}
      {visiblePhotos.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-12 text-center">
          <p className="text-gray-500 text-sm">No {activeCategory} photos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {visiblePhotos.map((photo) => {
            const url = getPublicUrl(photo.storage_path);
            const timeLabel = photo.taken_at ? fmtTime(photo.taken_at) : fmtTime(photo.created_at);
            return (
              <div key={photo.id} className="relative aspect-square">
                <button
                  onClick={() => setDetail(photo)}
                  className="w-full h-full rounded-xl overflow-hidden bg-[#1A1A1A] active:scale-95 transition-transform"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  {/* Time badge */}
                  <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md leading-none">
                    {timeLabel}
                  </span>
                </button>
                <button
                  onClick={() => setConfirmDeleteId(photo.id)}
                  aria-label="Delete photo"
                  className="absolute top-1 right-1 w-8 h-8 bg-black/70 rounded-lg flex items-center justify-center text-red-400 active:scale-95 transition-transform"
                >
                  <TrashIcon />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setConfirmDeleteId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <p className="text-white font-bold text-lg mb-1">Delete photo?</p>
            <p className="text-gray-400 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95">Cancel</button>
              <button onClick={handleDeleteConfirmed} disabled={deleting} className="flex-1 bg-red-600 text-white font-bold text-base py-4 rounded-xl active:scale-95 disabled:opacity-50">
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Fullscreen detail overlay */}
      {detail && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Close */}
          <button
            onClick={() => setDetail(null)}
            className="absolute top-5 right-5 text-white text-4xl leading-none z-10 w-11 h-11 flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getPublicUrl(detail.storage_path)}
              alt=""
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Info strip */}
          <div className="bg-black/90 border-t border-[#2a2a2a] px-5 py-4 flex flex-col gap-1.5 shrink-0"
               style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
            <p className="text-white font-semibold text-sm">
              {fmtFull(detail.taken_at ?? detail.created_at)}
            </p>
            {detail.lat !== null && detail.lng !== null ? (
              <div className="flex items-center gap-3">
                <p className="text-gray-400 text-xs font-mono">
                  {detail.lat.toFixed(6)}, {detail.lng.toFixed(6)}
                </p>
                {detail.accuracy !== null && (
                  <p className="text-gray-500 text-xs">
                    ±{Math.round(detail.accuracy * 3.281)} ft
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-600 text-xs">Location unavailable</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
