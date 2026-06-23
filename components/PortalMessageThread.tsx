"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PortalMessage } from "@/types";
import { getPortalMessages, sendPortalMessage } from "@/app/actions/portal-messages";
import PhotoMarkupEditor from "@/components/PhotoMarkupEditor";
import { compressImage } from "@/lib/compress-image";
import { portalPhotoProxyUrl } from "@/lib/photo-url";

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupByDay(msgs: PortalMessage[]) {
  const groups: { label: string; messages: PortalMessage[] }[] = [];
  let currentLabel = "";
  for (const m of msgs) {
    const label = fmtDate(m.created_at);
    if (label !== currentLabel) {
      groups.push({ label, messages: [m] });
      currentLabel = label;
    } else {
      groups[groups.length - 1].messages.push(m);
    }
  }
  return groups;
}

export default function PortalMessageThread({
  initialMessages,
  jobId,
  portalToken,
  clientName,
  contractorName,
  jobName,
}: {
  initialMessages: PortalMessage[];
  jobId: string;
  portalToken: string;
  clientName: string;
  contractorName: string;
  jobName: string;
}) {
  const [messages, setMessages]   = useState<PortalMessage[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const [sending, setSending]     = useState(false);
  const [markupFile, setMarkupFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Poll every 30s for new contractor messages
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      const fresh = await getPortalMessages(jobId, portalToken);
      setMessages(fresh);
    }, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, portalToken]);

  async function handleSend(text: string, attachmentUrl?: string) {
    if (!text.trim() && !attachmentUrl) return;
    setSending(true);
    try {
      await sendPortalMessage(jobId, portalToken, clientName, text.trim(), attachmentUrl);
      setInputText("");
      // Refresh thread
      const fresh = await getPortalMessages(jobId, portalToken);
      setMessages(fresh);
    } finally {
      setSending(false);
    }
  }

  async function handleMarkupDone(file: File) {
    setMarkupFile(null);
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("file", compressed, file.name);
      fd.append("jobId", jobId);
      fd.append("portalToken", portalToken);
      const res = await fetch("/api/portal-upload", { method: "POST", body: fd });
      const json = await res.json();
      // Store the storage path; it's served via the authorizing portal photo proxy.
      if (json.path) {
        await handleSend(inputText, json.path);
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  const groups = groupByDay(messages);

  return (
    <>
      {markupFile && (
        <PhotoMarkupEditor file={markupFile} onDone={handleMarkupDone} />
      )}

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

      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-5">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2a2a2a]">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Messages</p>
          <p className="text-gray-600 text-xs mt-0.5">{contractorName}</p>
        </div>

        {/* Thread */}
        <div className="px-4 py-4 flex flex-col gap-1 max-h-96 overflow-y-auto">
          {groups.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-6">
              No messages yet. Send a message to your contractor.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-gray-600 text-xs text-center my-3">{group.label}</p>
              {group.messages.map((msg) => {
                const isClient = msg.sender_type === "client";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col mb-3 ${isClient ? "items-end" : "items-start"}`}
                  >
                    <p className="text-gray-600 text-[10px] mb-1 px-1">{msg.sender_name} · {fmtTime(msg.created_at)}</p>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isClient ? "bg-white text-gray-900 rounded-br-sm" : "bg-[#2a2a2a] text-white rounded-bl-sm"}`}>
                      {msg.attachment_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={portalPhotoProxyUrl(msg.attachment_url, jobId, portalToken)}
                          alt="attachment"
                          className="w-full max-w-xs rounded-xl mb-2 object-cover cursor-pointer"
                          onClick={() => window.open(portalPhotoProxyUrl(msg.attachment_url!, jobId, portalToken), "_blank")}
                        />
                      )}
                      {msg.message_text && (
                        <p className="text-sm leading-relaxed">{msg.message_text}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Note */}
        <div className="px-5 pb-2">
          <p className="text-gray-600 text-[10px] text-center leading-relaxed">
            All messages are saved to your project record. {contractorName} sees them in their Sightline app.
          </p>
        </div>

        {/* Input */}
        <div className="border-t border-[#2a2a2a] px-4 py-3 flex items-end gap-2">
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={sending || uploadingPhoto}
            aria-label="Attach photo"
            className="shrink-0 w-10 h-10 rounded-xl bg-[#242424] border border-[#333] flex items-center justify-center text-gray-400 active:scale-95 transition-transform disabled:opacity-40"
          >
            {uploadingPhoto ? (
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
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(inputText);
              }
            }}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 bg-[#242424] border border-[#333] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 resize-none focus:outline-none focus:border-orange-500/50 min-h-[40px]"
            style={{ maxHeight: 120, overflowY: "auto" }}
          />
          <button
            onClick={() => handleSend(inputText)}
            disabled={sending || (!inputText.trim())}
            className="shrink-0 w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white active:scale-95 transition-transform disabled:opacity-40"
          >
            {sending ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
                <path d="M12 2a10 10 0 0 1 10 10"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
