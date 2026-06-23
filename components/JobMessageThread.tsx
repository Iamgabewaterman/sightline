"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PortalMessage } from "@/types";
import {
  sendContractorMessage,
  markPortalMessagesRead,
  getContractorMessages,
} from "@/app/actions/portal-messages";
import PhotoMarkupEditor from "@/components/PhotoMarkupEditor";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { photoProxyUrl } from "@/lib/photo-url";

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

export default function JobMessageThread({
  initialMessages,
  jobId,
}: {
  initialMessages: PortalMessage[];
  jobId: string;
}) {
  const [messages, setMessages]   = useState<PortalMessage[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const [sending, setSending]     = useState(false);
  const [markupFile, setMarkupFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Mark client messages read and subscribe to realtime
  useEffect(() => {
    markPortalMessagesRead(jobId);

    const supabase = createClient();
    const channel = supabase
      .channel(`portal_messages:${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "portal_messages",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          setMessages((prev) => {
            const newMsg = payload.new as PortalMessage;
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Mark new client messages read immediately
          if ((payload.new as PortalMessage).sender_type === "client") {
            markPortalMessagesRead(jobId);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [jobId]);

  async function handleSend(text: string, attachmentUrl?: string) {
    if (!text.trim() && !attachmentUrl) return;
    setSending(true);
    try {
      await sendContractorMessage(jobId, text.trim(), attachmentUrl);
      setInputText("");
      const fresh = await getContractorMessages(jobId);
      setMessages(fresh);
    } finally {
      setSending(false);
    }
  }

  async function handleMarkupDone(file: File) {
    setMarkupFile(null);
    setUploadingPhoto(true);
    try {
      const supabase = createClient();
      const compressed = await compressImage(file);
      const path = `${jobId}/portal-messages/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { data, error } = await supabase.storage
        .from("job-photos")
        .upload(path, compressed, { contentType: "image/jpeg" });
      if (!error && data) {
        // Store the storage path; it's served via the authorizing photo proxy.
        await handleSend(inputText, path);
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

      {/* Thread */}
      <div className="flex flex-col gap-1 max-h-96 overflow-y-auto px-1 py-2">
        {groups.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-6">
            No messages yet. Send the client a message once the portal is enabled.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-gray-600 text-xs text-center my-3">{group.label}</p>
            {group.messages.map((msg) => {
              const isContractor = msg.sender_type === "contractor";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col mb-3 ${isContractor ? "items-end" : "items-start"}`}
                >
                  <p className="text-gray-600 text-[10px] mb-1 px-1">{msg.sender_name} · {fmtTime(msg.created_at)}</p>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isContractor ? "bg-orange-500 text-white rounded-br-sm" : "bg-[#2a2a2a] text-white rounded-bl-sm"}`}>
                    {msg.attachment_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoProxyUrl(msg.attachment_url)}
                        alt="attachment"
                        className="w-full max-w-xs rounded-xl mb-2 object-cover cursor-pointer"
                        onClick={() => window.open(photoProxyUrl(msg.attachment_url!), "_blank")}
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

      {/* Input */}
      <div className="flex items-end gap-2 mt-3 pt-3 border-t border-[#2a2a2a]">
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
          placeholder="Message client…"
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
    </>
  );
}
