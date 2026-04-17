"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import Avatar from "./Avatar";

interface Props {
  name: string;
  currentAvatarPath?: string | null;
  storagePath: string;
  onSaved: (path: string) => void | Promise<void>;
  size?: number;
}

export default function AvatarUpload({ name, currentAvatarPath, storagePath, onSaved, size = 80 }: Props) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  const displayUrl =
    localUrl ??
    (currentAvatarPath
      ? supabase.storage.from("avatars").getPublicUrl(currentAvatarPath).data.publicUrl
      : null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setSaveError("");
    try {
      const compressed = await compressImage(file);
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(storagePath, compressed, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      const url =
        supabase.storage.from("avatars").getPublicUrl(storagePath).data.publicUrl +
        "?t=" +
        Date.now();
      setLocalUrl(url);
      await onSaved(storagePath);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative shrink-0 active:scale-95 transition-transform"
        style={{ width: size, height: size }}
      >
        <Avatar name={name} avatarUrl={displayUrl} size={size} />
        {/* Tap hint overlay */}
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
          {uploading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </button>
      {saveError && (
        <p className="text-red-400 text-xs text-center max-w-[120px] leading-tight">{saveError}</p>
      )}
    </div>
  );
}
