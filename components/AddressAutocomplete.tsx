"use client";

import { useEffect, useRef, useState } from "react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

interface Suggestion {
  id: string;
  place_name: string;
}

const inputClass =
  "w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors min-h-[56px]";

/**
 * Required, prominent address field.
 * When NEXT_PUBLIC_MAPBOX_TOKEN is configured, it shows live address suggestions
 * as the contractor types. Otherwise it falls back to a simple structured input
 * (street / city / state / zip) that still formats into a single clean address.
 *
 * Submits the final address via a hidden input named "address".
 */
export default function AddressAutocomplete({ name = "address" }: { name?: string }) {
  const hasMapbox = MAPBOX_TOKEN.length > 0;

  // ── Autocomplete state ──────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Structured fallback state ───────────────────────────────────────────
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [zip, setZip] = useState("");

  const composedFallback = [
    street.trim(),
    [city.trim(), [stateCode.trim().toUpperCase(), zip.trim()].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join(", ");

  useEffect(() => {
    if (!hasMapbox) return;
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
          `?access_token=${MAPBOX_TOKEN}&autocomplete=true&country=US&types=address&limit=5`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        const feats = (json?.features ?? []) as { id: string; place_name: string }[];
        setSuggestions(feats.map((f) => ({ id: f.id, place_name: f.place_name })));
        setOpen(true);
      } catch {
        // Network/geocode failure — leave the typed text as-is, no suggestions.
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, hasMapbox]);

  function pick(s: Suggestion) {
    setQuery(s.place_name);
    setSuggestions([]);
    setOpen(false);
  }

  if (!hasMapbox) {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
          Job Address
        </label>
        <input type="hidden" name={name} value={composedFallback} />
        <input
          type="text"
          required
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          placeholder="Street address"
          autoCapitalize="words"
          className={inputClass}
        />
        <input
          type="text"
          required
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          autoCapitalize="words"
          className={inputClass}
        />
        <div className="flex gap-2">
          <input
            type="text"
            required
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value.slice(0, 2))}
            placeholder="State"
            maxLength={2}
            autoCapitalize="characters"
            className={`${inputClass} w-24 uppercase`}
          />
          <input
            type="text"
            required
            inputMode="numeric"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/[^\d-]/g, "").slice(0, 10))}
            placeholder="ZIP"
            className={`${inputClass} flex-1`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
        Job Address
      </label>
      <div className="relative">
        <input
          name={name}
          type="text"
          required
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Start typing the job address…"
          autoCapitalize="words"
          autoComplete="off"
          className={inputClass}
        />
        {open && suggestions.length > 0 && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-xl">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                // onMouseDown fires before the input blur, so the tap registers on mobile + desktop
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                className="w-full text-left px-4 py-3.5 min-h-[48px] text-white text-base border-b border-[#222] last:border-b-0 active:bg-[#1f1f1f]"
              >
                {s.place_name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
