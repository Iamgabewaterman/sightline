"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Photo, PhotoCategory } from "@/types";

const CATEGORIES: { value: PhotoCategory; label: string }[] = [
  { value: "before", label: "Before" },
  { value: "during", label: "During" },
  { value: "after", label: "After" },
  { value: "damages", label: "Damages" },
];

async function compressImage(file: File, maxMB = 1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      const MAX_DIM = 1920;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      const attempt = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Compression failed"));
            if (blob.size <= maxMB * 1024 * 1024 || quality <= 0.2) {
              resolve(blob);
            } else {
              quality = Math.round((quality - 0.1) * 10) / 10;
              attempt();
            }
          },
          "image/jpeg",
          quality
        );
      };
      attempt();
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    };

    img.src = objectUrl;
  });
}

interface Props {
  jobId: string;
  initialPhotos: Photo[];
}

export default function PhotoSection({ jobId, initialPhotos }: Props) {
  const [activeCategory, setActiveCategory] = useState<PhotoCategory>("before");
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const getPublicUrl = useCallback(
    (path: string) =>
      supabase.storage.from("job-photos").getPublicUrl(path).data.publicUrl,
    [supabase]
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");

    const errors: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImage(file);
        const ext = "jpg";
        const path = `${jobId}/${activeCategory}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("job-photos")
          .upload(path, compressed, { contentType: "image/jpeg" });

        if (uploadError) {
          errors.push(uploadError.message);
          continue;
        }

        const { data: photo, error: dbError } = await supabase
          .from("photos")
          .insert({ job_id: jobId, category: activeCategory, storage_path: path })
          .select()
          .single<Photo>();

        if (dbError) {
          errors.push(dbError.message);
        } else if (photo) {
          setPhotos((prev) => [photo, ...prev]);
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "Upload failed");
      }
    }

    if (errors.length > 0) setError(errors.join(" · "));
    setUploading(false);

    // Reset inputs so the same file can be re-selected
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  const visiblePhotos = photos.filter((p) => p.category === activeCategory);

  return (
    <div className="mt-8">
      {/* Section header */}
      <h2 className="text-white font-bold text-xl mb-4">Photos</h2>

      {/* Category tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveCategory(value)}
            className={`shrink-0 px-4 py-3 rounded-xl font-semibold text-sm transition-colors active:scale-95
              ${activeCategory === value
                ? "bg-white text-black"
                : "bg-zinc-900 text-zinc-400 border border-zinc-700"
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
          className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-700 text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          <span className="text-xl">📷</span>
          Take Photo
        </button>
        <button
          onClick={() => galleryInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-700 text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          <span className="text-xl">🖼️</span>
          Upload Photo
        </button>
      </div>

      {/* Hidden inputs */}
      {/* Camera: capture="environment" triggers rear camera on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {/* Gallery: no capture attr = file picker / photo library */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Uploading indicator */}
      {uploading && (
        <p className="text-zinc-400 text-sm mb-4 animate-pulse">Compressing and uploading...</p>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {/* Photo grid */}
      {visiblePhotos.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-12 text-center">
          <p className="text-zinc-600 text-sm">
            No {activeCategory} photos yet
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {visiblePhotos.map((photo) => {
            const url = getPublicUrl(photo.storage_path);
            return (
              <button
                key={photo.id}
                onClick={() => setFullscreen(url)}
                className="aspect-square rounded-xl overflow-hidden bg-zinc-900 active:scale-95 transition-transform"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={() => setFullscreen(null)}
        >
          <button
            onClick={() => setFullscreen(null)}
            className="absolute top-5 right-5 text-white text-4xl leading-none z-10"
            aria-label="Close"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullscreen}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
