"use client";

import { useEffect, useRef, useState } from "react";
import { Client } from "@/types";
import { createClient as supabaseClient } from "@/lib/supabase/client";

interface Props {
  /** Fires with the resolved client id (null until a saved client is chosen) and the current name text. */
  onChange: (clientId: string | null, clientName: string) => void;
}

const inputClass =
  "w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors min-h-[56px]";

/**
 * Inline, type-ahead client picker. Pulls saved clients from the clients table
 * and shows matching names as the contractor types. Selecting a match links the
 * job to that client; typing a brand-new name creates the client on submit.
 */
export default function ClientNameAutocomplete({ onChange }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    const sb = supabaseClient();
    sb.from("clients")
      .select("*")
      .order("name", { ascending: true })
      .then(({ data }) => {
        setClients((data as Client[]) ?? []);
        loaded.current = true;
      });
  }, []);

  const matches = query.trim()
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          (c.company ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : clients.slice(0, 8);

  // Hide the dropdown when the typed text already exactly matches the chosen client.
  const exactSelected =
    selectedId !== null &&
    clients.find((c) => c.id === selectedId)?.name.toLowerCase() === query.trim().toLowerCase();

  function update(id: string | null, name: string) {
    setSelectedId(id);
    setQuery(name);
    onChange(id, name);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
        Client Name
      </label>
      <div className="relative">
        <input
          type="text"
          required
          value={query}
          onChange={(e) => {
            // Any edit breaks the link to a previously-selected client.
            update(null, e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Start typing a client name…"
          autoCapitalize="words"
          autoComplete="off"
          className={inputClass}
        />
        {open && !exactSelected && matches.length > 0 && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-xl max-h-64 overflow-y-auto">
            {matches.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  update(c.id, c.name);
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-3 min-h-[48px] border-b border-[#222] last:border-b-0 active:bg-[#1f1f1f]"
              >
                <span className="text-white text-base font-semibold">{c.name}</span>
                {c.company && <span className="text-gray-500 text-sm ml-2">{c.company}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {query.trim() && selectedId === null && (
        <p className="text-gray-500 text-xs pl-1">
          New client — “{query.trim()}” will be saved to your clients.
        </p>
      )}
    </div>
  );
}
