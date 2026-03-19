"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { JobDocument } from "@/types";
import { deleteDocument } from "@/app/actions/documents";

const DOC_CATEGORIES = [
  { value: "permit", label: "Permit" },
  { value: "contract", label: "Contract" },
  { value: "inspection", label: "Inspection" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other" },
];

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DocIcon({ fileType }: { fileType: string }) {
  const isPdf = fileType === "application/pdf";
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPdf ? "bg-red-500/15" : "bg-blue-500/15"}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={isPdf ? "#F87171" : "#60A5FA"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    </div>
  );
}

interface Props {
  jobId: string;
  initialDocuments: JobDocument[];
}

export default function DocumentsSection({ jobId, initialDocuments }: Props) {
  const [documents, setDocuments] = useState<JobDocument[]>(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewing, setViewing] = useState<{ doc: JobDocument; url: string } | null>(null);
  const [showUploadSheet, setShowUploadSheet] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setUploading(false); return; }

    const errors: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${user.id}/${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("job-documents")
          .upload(path, file, { contentType: file.type });

        if (uploadError) { errors.push(uploadError.message); continue; }

        const { data: doc, error: dbError } = await supabase
          .from("documents")
          .insert({
            job_id: jobId,
            user_id: user.id,
            name: file.name,
            category: uploadCategory,
            storage_path: path,
            file_type: file.type,
            file_size: file.size,
          })
          .select()
          .single<JobDocument>();

        if (dbError) {
          errors.push(dbError.message);
          await supabase.storage.from("job-documents").remove([path]);
        } else if (doc) {
          setDocuments((prev) => [doc, ...prev]);
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "Upload failed");
      }
    }

    if (errors.length > 0) setError(errors.join(" · "));
    setUploading(false);
    setShowUploadSheet(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDeleteConfirmed() {
    if (!confirmDeleteId) return;
    const doc = documents.find((d) => d.id === confirmDeleteId);
    if (!doc) return;
    setDeleting(true);
    await deleteDocument(doc.id, doc.storage_path);
    setDocuments((prev) => prev.filter((d) => d.id !== confirmDeleteId));
    if (viewing?.doc.id === confirmDeleteId) setViewing(null);
    setConfirmDeleteId(null);
    setDeleting(false);
  }

  async function handleView(doc: JobDocument) {
    const { data } = await supabase.storage
      .from("job-documents")
      .createSignedUrl(doc.storage_path, 300);
    if (data?.signedUrl) {
      setViewing({ doc, url: data.signedUrl });
    }
  }

  const catLabel = (cat: string) =>
    DOC_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-xl">Documents</h2>
        <button
          onClick={() => setShowUploadSheet(true)}
          className="text-sm font-semibold text-orange-400 px-3 py-2 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform"
        >
          + Add File
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3 mb-4">{error}</p>
      )}

      {documents.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
          <p className="text-gray-500 text-sm">No documents yet</p>
          <p className="text-gray-600 text-xs mt-1">Permits, contracts, inspections...</p>
        </div>
      ) : (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="divide-y divide-[#222]">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => handleView(doc)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70"
                >
                  <DocIcon fileType={doc.file_type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold text-sm truncate">{doc.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {catLabel(doc.category)} · {fmtSize(doc.file_size)} · {fmtDate(doc.created_at)}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setConfirmDeleteId(doc.id)}
                  aria-label="Delete"
                  className="w-9 h-9 flex items-center justify-center text-gray-600 active:text-red-400 transition-colors shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload sheet */}
      {showUploadSheet && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowUploadSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}>
            <p className="text-white font-bold text-lg mb-4">Add Document</p>

            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Category</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {DOC_CATEGORIES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setUploadCategory(value)}
                  className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors active:scale-95 ${
                    uploadCategory === value
                      ? "bg-orange-500 text-white"
                      : "bg-[#1A1A1A] text-gray-400 border border-[#2a2a2a]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowUploadSheet(false)}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Choose File"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setConfirmDeleteId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <p className="text-white font-bold text-lg mb-1">Delete document?</p>
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

      {/* Document viewer */}
      {viewing && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] bg-[#141414] shrink-0"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-white font-semibold text-sm truncate">{viewing.doc.name}</p>
              <p className="text-gray-500 text-xs">{catLabel(viewing.doc.category)}</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={viewing.url}
                download={viewing.doc.name}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 text-sm font-semibold px-3 py-2 rounded-xl border border-[#2a2a2a] active:scale-95"
              >
                Open
              </a>
              <button
                onClick={() => setViewing(null)}
                className="text-gray-400 text-3xl leading-none w-10 h-10 flex items-center justify-center"
              >
                ×
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {viewing.doc.file_type === "application/pdf" ? (
              <iframe
                src={viewing.url}
                className="w-full h-full border-0"
                title={viewing.doc.name}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={viewing.url}
                  alt={viewing.doc.name}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
