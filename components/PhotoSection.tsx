"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Photo, PhotoCategory } from "@/types";
import { compressImage } from "@/lib/compress-image";
import { deletePhoto } from "@/app/actions/photos";
import { generatePhotoReportPDF, PhotoReportDocument } from "@/lib/generatePhotoReportPDF";
import { notifyOwnerPhotosUploaded } from "@/app/actions/notify-photos";

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
  jobName?: string;
  jobAddress?: string;
  clientName?: string | null;
  initialPhotos: Photo[];
  documents?: PhotoReportDocument[] | null;
}

export default function PhotoSection({ jobId, jobName = "", jobAddress = "", clientName, initialPhotos, documents }: Props) {
  const [activeCategory,   setActiveCategory]   = useState<PhotoCategory>("before");
  const [photos,           setPhotos]           = useState<Photo[]>(initialPhotos);
  const [uploading,        setUploading]        = useState(false);
  const [error,            setError]            = useState("");
  const [detail,           setDetail]           = useState<Photo | null>(null);
  const [confirmDeleteId,  setConfirmDeleteId]  = useState<string | null>(null);
  const [deleting,         setDeleting]         = useState(false);
  const [showExport,       setShowExport]       = useState(false);
  const [exportCats,       setExportCats]       = useState<Set<PhotoCategory>>(new Set<PhotoCategory>(["before","during","after","damages"]));
  const [generating,       setGenerating]       = useState(false);
  const [exportError,      setExportError]      = useState("");

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

    const uploaded = Array.from(files).length - errors.length;
    if (uploaded > 0) notifyOwnerPhotosUploaded(jobId, uploaded);
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

  async function handleGenerateReport() {
    if (exportCats.size === 0) return;
    setGenerating(true);
    setExportError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: bp } = user
        ? await supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle()
        : { data: null };

      let logoUrl: string | null = null;
      if (bp?.logo_path) {
        logoUrl = supabase.storage.from("business-logos").getPublicUrl(bp.logo_path).data.publicUrl;
      }

      await generatePhotoReportPDF({
        jobName,
        jobAddress,
        clientName,
        selectedCategories: Array.from(exportCats) as PhotoCategory[],
        photos,
        businessProfile: bp,
        logoUrl,
        getPublicUrl,
        documents,
      });
      setShowExport(false);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  function toggleExportCat(cat: PhotoCategory) {
    setExportCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  const visiblePhotos = photos.filter((p) => p.category === activeCategory);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-xl">Photos</h2>
        <button
          onClick={() => setShowExport(true)}
          className="text-sm font-semibold text-orange-400 px-3 py-2 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform"
        >
          Export Report
        </button>
      </div>

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

      {/* Export Report sheet */}
      {showExport && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowExport(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <p className="text-white font-bold text-lg mb-1">Export Photo Report</p>
            <p className="text-gray-400 text-sm mb-5">Select categories to include</p>

            <div className="flex flex-col gap-3 mb-6">
              {CATEGORIES.map(({ value, label }) => {
                const count = photos.filter((p) => p.category === value).length;
                const checked = exportCats.has(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleExportCat(value)}
                    className={`flex items-center justify-between px-4 py-4 rounded-xl border transition-colors active:scale-95 ${
                      checked
                        ? "bg-orange-500/10 border-orange-500 text-white"
                        : "bg-[#1A1A1A] border-[#2a2a2a] text-gray-400"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        checked ? "bg-orange-500 border-orange-500" : "border-gray-600"
                      }`}>
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className="font-semibold text-base">{label}</span>
                    </div>
                    <span className="text-sm text-gray-500">{count} photo{count !== 1 ? "s" : ""}</span>
                  </button>
                );
              })}
            </div>

            {exportError && (
              <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3 mb-4">{exportError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowExport(false)}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={generating || exportCats.size === 0}
                className="flex-1 bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate PDF"}
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
