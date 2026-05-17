"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PunchListItem, PunchListPhoto } from "@/types";
import { compressImage } from "@/lib/compress-image";
import {
  addPunchListItem,
  togglePunchListItem,
  deletePunchListItem,
  deletePunchListPhoto,
} from "@/app/actions/punch-list";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CameraIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

export default function PunchListSection({
  jobId,
  initialItems,
  initialPhotos,
}: {
  jobId: string;
  initialItems: PunchListItem[];
  initialPhotos: PunchListPhoto[];
}) {
  const [items, setItems] = useState<PunchListItem[]>(initialItems);
  const [photos, setPhotos] = useState<PunchListPhoto[]>(initialPhotos);

  // Task list state
  const [showAdd, setShowAdd] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Photo state
  const [showAddPhotoSheet, setShowAddPhotoSheet] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [photoDesc, setPhotoDesc] = useState("");
  const [linkedItemId, setLinkedItemId] = useState<string>("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [fullscreenPhoto, setFullscreenPhoto] = useState<PunchListPhoto | null>(null);
  const [longPressPhotoId, setLongPressPhotoId] = useState<string | null>(null);
  const [confirmDeletePhotoId, setConfirmDeletePhotoId] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (showAdd) inputRef.current?.focus();
  }, [showAdd]);

  // Clean up preview URL
  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  const getPublicUrl = useCallback(
    (path: string) => supabase.storage.from("job-photos").getPublicUrl(path).data.publicUrl,
    [supabase]
  );

  const open = items.filter((i) => !i.completed);
  const done = items.filter((i) => i.completed);
  const total = items.length;
  const completedCount = done.length;

  const sorted = [
    ...open.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    ...done.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
  ];

  // Map item_id -> has photos
  const itemPhotoSet = new Set(photos.map((p) => p.punch_list_item_id).filter(Boolean));

  async function handleAdd() {
    if (!description.trim()) return;
    setSaving(true);
    setAddError("");
    const res = await addPunchListItem(jobId, description);
    setSaving(false);
    if (res.error) { setAddError(res.error); return; }
    setItems((prev) => [...prev, res.item!]);
    setDescription("");
    setShowAdd(false);
  }

  async function handleToggle(item: PunchListItem) {
    setTogglingId(item.id);
    setItems((prev) => prev.map((i) =>
      i.id === item.id ? { ...i, completed: !i.completed, completed_at: !i.completed ? new Date().toISOString() : null } : i
    ));
    const res = await togglePunchListItem(item.id, !item.completed);
    setTogglingId(null);
    if (res.item) {
      setItems((prev) => prev.map((i) => i.id === res.item!.id ? res.item! : i));
    }
  }

  async function handleDelete(id: string) {
    await deletePunchListItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setConfirmDeleteId(null);
  }

  function handleFileSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    setPhotoDesc("");
    setLinkedItemId("");
    setPhotoError("");
  }

  function resetPhotoSheet() {
    setShowAddPhotoSheet(false);
    setPendingFile(null);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
    setPhotoDesc("");
    setLinkedItemId("");
    setPhotoError("");
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  async function handleSavePhoto() {
    if (!pendingFile) return;
    setUploadingPhoto(true);
    setPhotoError("");
    try {
      const compressed = await compressImage(pendingFile);
      const path = `${jobId}/punch-list/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("job-photos")
        .upload(path, compressed, { contentType: "image/jpeg" });
      if (uploadErr) { setPhotoError(uploadErr.message); setUploadingPhoto(false); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhotoError("Not authenticated"); setUploadingPhoto(false); return; }

      const insert: Record<string, unknown> = {
        job_id: jobId,
        user_id: user.id,
        storage_path: path,
        description: photoDesc.trim(),
        punch_list_item_id: linkedItemId || null,
      };
      const { data: photo, error: dbErr } = await supabase
        .from("punch_list_photos")
        .insert(insert)
        .select()
        .single<PunchListPhoto>();
      if (dbErr) { setPhotoError(dbErr.message); setUploadingPhoto(false); return; }
      if (photo) setPhotos((prev) => [photo, ...prev]);
      resetPhotoSheet();
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "Upload failed");
    }
    setUploadingPhoto(false);
  }

  async function handleDeletePhoto(photoId: string) {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;
    await deletePunchListPhoto(photoId, photo.storage_path);
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setConfirmDeletePhotoId(null);
    setLongPressPhotoId(null);
  }

  function startLongPress(photoId: string) {
    longPressTimer.current = setTimeout(() => {
      setLongPressPhotoId(photoId);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  const itemMap = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="mt-8">
      {/* ── Task List Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-bold text-xl">Punch List</h2>
          {total > 0 && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              completedCount === total
                ? "bg-green-500/20 border-green-500/40 text-green-400"
                : "bg-[#2a2a2a] border-[#333] text-gray-400"
            }`}>
              {completedCount} of {total}
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowAdd((s) => !s); setAddError(""); setDescription(""); }}
          className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform"
        >
          {showAdd ? "Cancel" : "+ Add Item"}
        </button>
      </div>

      {/* Add task form */}
      {showAdd && (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4 flex flex-col gap-3">
          <input
            ref={inputRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Describe the snag item…"
            className="bg-[#242424] border border-[#333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 w-full"
          />
          {addError && <p className="text-red-400 text-sm">{addError}</p>}
          <button
            onClick={handleAdd}
            disabled={saving || !description.trim()}
            className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add Item"}
          </button>
        </div>
      )}

      {/* Empty state — no items and no photos */}
      {items.length === 0 && !showAdd && photos.length === 0 && (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
          <p className="text-gray-500 text-sm">No punch list items yet</p>
          <p className="text-gray-600 text-xs mt-1">Add snag items as you identify them during the job.</p>
        </div>
      )}

      {/* Task items */}
      {sorted.length > 0 && (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <div
              key={item.id}
              className={`bg-[#1A1A1A] border rounded-xl px-4 py-4 flex items-start gap-4 ${
                item.completed ? "border-[#222] opacity-70" : "border-[#2a2a2a]"
              }`}
            >
              <button
                onClick={() => handleToggle(item)}
                disabled={togglingId === item.id}
                className={`w-7 h-7 mt-0.5 shrink-0 rounded-lg border-2 flex items-center justify-center active:scale-90 transition-all ${
                  item.completed
                    ? "bg-green-500 border-green-500"
                    : "bg-transparent border-[#444] active:border-orange-500"
                }`}
                aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
              >
                {item.completed && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-base leading-snug ${item.completed ? "line-through text-gray-500" : "text-white"}`}>
                    {item.description}
                  </p>
                  {itemPhotoSet.has(item.id) && (
                    <span className="text-orange-400 shrink-0">
                      <CameraIcon size={13} />
                    </span>
                  )}
                </div>
                {item.completed && item.completed_at && (
                  <p className="text-green-600 text-xs mt-0.5">✓ {fmtDate(item.completed_at)}</p>
                )}
                {!item.completed && (
                  <p className="text-gray-600 text-xs mt-0.5">Added {fmtDate(item.created_at)}</p>
                )}
              </div>

              <button
                onClick={() => setConfirmDeleteId(item.id)}
                className="text-[#333] hover:text-red-400 w-9 h-9 flex items-center justify-center rounded-lg active:scale-90 transition-colors shrink-0"
                aria-label="Delete item"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                </svg>
              </button>
            </div>
          ))}

          {total > 0 && completedCount === total && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <p className="text-green-400 text-sm font-semibold">All punch list items complete</p>
            </div>
          )}
        </div>
      )}

      {/* ── Visual Divider ───────────────────────────────────── */}
      <div className="mt-8 mb-6 border-t border-[#2a2a2a]" />

      {/* ── Photo Documentation Section ──────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-white font-bold text-lg">Photo Notes</h3>
        {photos.length > 0 && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-[#2a2a2a] border-[#333] text-gray-400">
            {photos.length}
          </span>
        )}
      </div>

      {photos.length === 0 && (
        <p className="text-gray-600 text-sm mb-4">No photo notes yet. Add photos to document issues that need attention.</p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {photos.map((photo) => {
            const linkedItem = photo.punch_list_item_id ? itemMap.get(photo.punch_list_item_id) : null;
            const isCompleted = linkedItem?.completed === true;
            return (
              <div
                key={photo.id}
                className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden"
                onTouchStart={() => startLongPress(photo.id)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                onMouseDown={() => startLongPress(photo.id)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
              >
                <button
                  className="w-full text-left"
                  onClick={() => setFullscreenPhoto(photo)}
                >
                  <div className="relative aspect-square w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getPublicUrl(photo.storage_path)}
                      alt={photo.description || "Photo note"}
                      className="w-full h-full object-cover"
                    />
                    {isCompleted && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  {photo.description && (
                    <div className="px-3 py-2">
                      <p className="text-gray-300 text-xs leading-snug line-clamp-2">
                        {photo.description}
                      </p>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Photo Note button */}
      <button
        onClick={() => setShowAddPhotoSheet(true)}
        className="w-full flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-sm py-4 rounded-xl active:scale-95 transition-transform"
      >
        <CameraIcon size={15} />
        Add Photo Note
      </button>

      {/* ── Add Photo Note bottom sheet ───────────────────────── */}
      {showAddPhotoSheet && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={pendingFile ? undefined : resetPhotoSheet} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <p className="text-white font-bold text-lg">Add Photo Note</p>
              <button onClick={resetPhotoSheet} className="text-gray-500 hover:text-white w-9 h-9 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {!pendingFile ? (
              /* Step 1: choose source */
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-5 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-3"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  Take Photo
                </button>
                <button
                  onClick={() => galleryRef.current?.click()}
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-5 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-3"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  Choose from Library
                </button>
              </div>
            ) : (
              /* Step 2: description + optional link */
              <div className="flex flex-col gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingPreview!}
                  alt="Preview"
                  className="w-full aspect-video object-cover rounded-xl"
                />
                <div>
                  <textarea
                    value={photoDesc}
                    onChange={(e) => setPhotoDesc(e.target.value.slice(0, 120))}
                    placeholder="What needs to be done here?"
                    rows={3}
                    className="w-full bg-[#242424] border border-[#333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 resize-none"
                  />
                  <p className="text-gray-600 text-xs text-right mt-1">{photoDesc.length}/120</p>
                </div>
                {items.length > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1.5">Link to task (optional)</p>
                    <select
                      value={linkedItemId}
                      onChange={(e) => setLinkedItemId(e.target.value)}
                      className="w-full bg-[#242424] border border-[#333] text-white rounded-xl px-4 py-4 text-sm focus:outline-none focus:border-orange-500 appearance-none"
                    >
                      <option value="">No link</option>
                      {items.filter((i) => !i.completed).map((i) => (
                        <option key={i.id} value={i.id}>{i.description}</option>
                      ))}
                      {items.filter((i) => i.completed).map((i) => (
                        <option key={i.id} value={i.id}>{i.description} ✓</option>
                      ))}
                    </select>
                  </div>
                )}
                {photoError && <p className="text-red-400 text-sm">{photoError}</p>}
                <button
                  onClick={handleSavePhoto}
                  disabled={uploadingPhoto}
                  className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                >
                  {uploadingPhoto ? "Saving…" : "Save Photo Note"}
                </button>
                <button
                  onClick={() => { setPendingFile(null); if (pendingPreview) URL.revokeObjectURL(pendingPreview); setPendingPreview(null); }}
                  className="w-full text-gray-500 text-sm py-2"
                >
                  ← Choose different photo
                </button>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files)}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files)}
            />
          </div>
        </>
      )}

      {/* ── Fullscreen photo viewer ───────────────────────────── */}
      {fullscreenPhoto && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black"
            onClick={() => setFullscreenPhoto(null)}
          />
          <div className="fixed inset-0 z-50 flex flex-col" onClick={() => setFullscreenPhoto(null)}>
            <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPublicUrl(fullscreenPhoto.storage_path)}
                alt={fullscreenPhoto.description || "Photo note"}
                className="max-w-full max-h-[70vh] object-contain rounded-xl"
              />
            </div>
            {fullscreenPhoto.description && (
              <div className="px-5 pb-6 pt-3" onClick={(e) => e.stopPropagation()}>
                <p className="text-white text-base leading-relaxed">{fullscreenPhoto.description}</p>
                {fullscreenPhoto.punch_list_item_id && itemMap.get(fullscreenPhoto.punch_list_item_id) && (
                  <p className="text-gray-500 text-xs mt-2 flex items-center gap-1">
                    <CameraIcon size={11} />
                    Linked: {itemMap.get(fullscreenPhoto.punch_list_item_id)!.description}
                  </p>
                )}
              </div>
            )}
            <button
              className="absolute top-4 right-4 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center text-white"
              onClick={() => setFullscreenPhoto(null)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </>
      )}

      {/* ── Long-press photo action sheet ────────────────────── */}
      {longPressPhotoId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setLongPressPhotoId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <button
              onClick={() => { setConfirmDeletePhotoId(longPressPhotoId); setLongPressPhotoId(null); }}
              className="w-full flex items-center gap-3 text-red-400 font-semibold py-4 text-base"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
              Delete Photo Note
            </button>
            <button onClick={() => setLongPressPhotoId(null)} className="w-full text-gray-500 text-sm py-3">
              Cancel
            </button>
          </div>
        </>
      )}

      {/* ── Delete task confirmation ──────────────────────────── */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setConfirmDeleteId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <p className="text-white font-bold text-lg mb-1">Remove this item?</p>
            <p className="text-gray-400 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95">
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl active:scale-95">
                Remove
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete photo confirmation ─────────────────────────── */}
      {confirmDeletePhotoId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setConfirmDeletePhotoId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <p className="text-white font-bold text-lg mb-1">Delete this photo note?</p>
            <p className="text-gray-400 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeletePhotoId(null)}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95">
                Cancel
              </button>
              <button onClick={() => handleDeletePhoto(confirmDeletePhotoId)}
                className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl active:scale-95">
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
