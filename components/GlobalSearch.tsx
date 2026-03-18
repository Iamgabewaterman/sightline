"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Clock, ChevronDown, ChevronUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobResult       { id: string; name: string; address: string | null; status: string; types: string[] }
interface ClientResult    { id: string; name: string; company: string | null; phone: string | null; email: string | null }
interface ReceiptResult   { id: string; jobId: string; jobName: string; vendor: string | null; amount: number | null; createdAt: string; category: string | null }
interface MaterialResult  { id: string; jobId: string; jobName: string; name: string; unitCost: number | null }
interface InvoiceResult   { id: string; jobId: string; jobName: string; invoiceNumber: string; totalAmount: number; status: string; clientName: string | null }

interface SearchResults {
  jobs: JobResult[];
  clients: ClientResult[];
  receipts: ReceiptResult[];
  materials: MaterialResult[];
  invoices: InvoiceResult[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RECENT_KEY  = "sightline_recent_searches";
const MAX_RECENT  = 5;
const PREVIEW     = 3;

const STATUS_LABEL: Record<string, string> = {
  active:    "Active",
  on_hold:   "On Hold",
  completed: "Completed",
  archived:  "Archived",
};

const INV_STATUS: Record<string, { label: string; cls: string }> = {
  unpaid:  { label: "Unpaid",  cls: "text-red-400"    },
  sent:    { label: "Sent",    cls: "text-yellow-400" },
  paid:    { label: "Paid",    cls: "text-green-400"  },
};

function fmt(n: number) { return "$" + Math.round(n).toLocaleString("en-US"); }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}

function saveRecent(q: string) {
  const prev = getRecent().filter((r) => r !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}

function clearRecent() { localStorage.removeItem(RECENT_KEY); }

// ─── Section component ────────────────────────────────────────────────────────

function Section<T>({
  label,
  items,
  total,
  onExpand,
  expanded,
  renderItem,
}: {
  label: string;
  items: T[];
  total: number;
  onExpand: () => void;
  expanded: boolean;
  renderItem: (item: T) => React.ReactNode;
}) {
  if (total === 0) return null;
  const visible = expanded ? items : items.slice(0, PREVIEW);
  const hidden  = total - visible.length;

  return (
    <div className="mb-1">
      <p className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
        {label} <span className="text-gray-600 font-normal normal-case">({total})</span>
      </p>
      {visible.map((item, i) => (
        <div key={i}>{renderItem(item)}</div>
      ))}
      {!expanded && hidden > 0 && (
        <button
          onClick={onExpand}
          className="flex items-center gap-1.5 px-4 py-2.5 text-orange-500 text-sm font-semibold active:opacity-70 w-full"
        >
          <ChevronDown size={14} />
          See {hidden} more {label.toLowerCase()}
        </button>
      )}
      {expanded && total > PREVIEW && (
        <button
          onClick={onExpand}
          className="flex items-center gap-1.5 px-4 py-2.5 text-gray-500 text-sm active:opacity-70 w-full"
        >
          <ChevronUp size={14} />
          Show less
        </button>
      )}
    </div>
  );
}

// ─── Result row component ─────────────────────────────────────────────────────

function Row({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[#1A1A1A] active:bg-[#1A1A1A] transition-colors border-b border-[#1a1a1a]"
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GlobalSearch() {
  const router = useRouter();
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [recent,  setRecent]  = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const inputRef   = useRef<HTMLInputElement>(null);
  const touchStart = useRef(0);
  const abortRef   = useRef<AbortController | null>(null);

  // Focus input when overlay opens
  useEffect(() => {
    if (open) {
      setRecent(getRecent());
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setQuery("");
      setResults(null);
      setExpanded({});
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults(null); setLoading(false); return; }

    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = await res.json();
        setResults(data);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const close = useCallback(() => setOpen(false), []);

  function navigate(path: string) {
    if (query.length >= 2) saveRecent(query);
    setRecent(getRecent());
    close();
    router.push(path);
  }

  function pickRecent(q: string) {
    setQuery(q);
    inputRef.current?.focus();
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const hasResults = results && (
    results.jobs.length + results.clients.length + results.receipts.length +
    results.materials.length + results.invoices.length > 0
  );

  // Swipe-down to close
  function onTouchStart(e: React.TouchEvent) { touchStart.current = e.touches[0].clientY; }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.changedTouches[0].clientY - touchStart.current > 100) close();
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="w-10 h-10 flex items-center justify-center text-gray-400 active:text-white active:scale-90 transition-all"
      >
        <Search size={20} />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-[#0F0F0F] flex flex-col"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* ── Search bar header ── */}
          <div className="nav-safe-top shrink-0 flex items-center gap-3 px-4 pt-3 pb-3 border-b border-[#2a2a2a]">
            <div className="flex-1 flex items-center gap-2.5 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-2.5">
              <Search size={16} className="text-gray-500 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search jobs, clients, receipts…"
                className="flex-1 bg-transparent text-white text-base placeholder:text-gray-600 focus:outline-none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {query.length > 0 && (
                <button
                  onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                  className="text-gray-500 active:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              onClick={close}
              className="text-gray-400 font-semibold text-sm min-h-[44px] px-1 active:text-white"
            >
              Cancel
            </button>
          </div>

          {/* ── Scrollable content ── */}
          <div className="flex-1 overflow-y-auto">

            {/* Recent searches */}
            {!query && recent.length > 0 && (
              <div className="pt-2 pb-4">
                <div className="flex items-center justify-between px-4 py-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent</p>
                  <button
                    onClick={() => { clearRecent(); setRecent([]); }}
                    className="text-xs text-gray-600 active:text-gray-400"
                  >
                    Clear
                  </button>
                </div>
                {recent.map((r) => (
                  <button
                    key={r}
                    onClick={() => pickRecent(r)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 active:bg-[#1A1A1A] transition-colors"
                  >
                    <Clock size={15} className="text-gray-600 shrink-0" />
                    <span className="text-gray-300 text-sm">{r}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Prompt when no query */}
            {!query && recent.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-20 px-8 text-center">
                <Search size={36} className="text-gray-700 mb-4" />
                <p className="text-gray-500 text-base">Search jobs, clients, receipts, materials, and invoices</p>
              </div>
            )}

            {/* Loading */}
            {loading && query.length >= 2 && (
              <div className="flex items-center justify-center pt-12">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* No results */}
            {!loading && results && !hasResults && (
              <div className="flex flex-col items-center justify-center pt-16 px-8 text-center">
                <p className="text-white font-semibold text-lg mb-2">No results for "{query}"</p>
                <p className="text-gray-500 text-sm">Check spelling, or try a more general term.</p>
              </div>
            )}

            {/* Results */}
            {!loading && results && hasResults && (
              <div className="pt-2 pb-24">

                {/* ── Jobs ── */}
                <Section
                  label="Jobs"
                  items={results.jobs}
                  total={results.jobs.length}
                  expanded={!!expanded.jobs}
                  onExpand={() => toggleExpand("jobs")}
                  renderItem={(job) => (
                    <Row key={job.id} onClick={() => navigate(`/jobs/${job.id}`)}>
                      <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-orange-500 text-xs font-black">J</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{job.name}</p>
                        <p className="text-gray-500 text-xs truncate mt-0.5">
                          {[job.address, STATUS_LABEL[job.status] ?? job.status].filter(Boolean).join(" · ")}
                        </p>
                        {job.types?.length > 0 && (
                          <p className="text-orange-500/70 text-xs mt-0.5 truncate">{job.types.join(", ")}</p>
                        )}
                      </div>
                    </Row>
                  )}
                />

                {/* ── Clients ── */}
                <Section
                  label="Clients"
                  items={results.clients}
                  total={results.clients.length}
                  expanded={!!expanded.clients}
                  onExpand={() => toggleExpand("clients")}
                  renderItem={(client) => (
                    <Row key={client.id} onClick={() => navigate(`/clients/${client.id}`)}>
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-blue-400 text-xs font-black">C</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{client.name}</p>
                        <p className="text-gray-500 text-xs truncate mt-0.5">
                          {[client.company, client.phone, client.email].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </Row>
                  )}
                />

                {/* ── Receipts ── */}
                <Section
                  label="Receipts"
                  items={results.receipts}
                  total={results.receipts.length}
                  expanded={!!expanded.receipts}
                  onExpand={() => toggleExpand("receipts")}
                  renderItem={(r) => (
                    <Row key={r.id} onClick={() => navigate(`/jobs/${r.jobId}`)}>
                      <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-green-400 text-xs font-black">R</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{r.vendor ?? "Unknown vendor"}</p>
                        <p className="text-gray-500 text-xs truncate mt-0.5">
                          {[r.amount != null ? fmt(r.amount) : null, fmtDate(r.createdAt), r.jobName].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </Row>
                  )}
                />

                {/* ── Materials ── */}
                <Section
                  label="Materials"
                  items={results.materials}
                  total={results.materials.length}
                  expanded={!!expanded.materials}
                  onExpand={() => toggleExpand("materials")}
                  renderItem={(m) => (
                    <Row key={m.id} onClick={() => navigate(`/jobs/${m.jobId}`)}>
                      <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-purple-400 text-xs font-black">M</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{m.name}</p>
                        <p className="text-gray-500 text-xs truncate mt-0.5">
                          {[m.unitCost != null ? `$${m.unitCost}/unit` : null, m.jobName].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </Row>
                  )}
                />

                {/* ── Invoices ── */}
                <Section
                  label="Invoices"
                  items={results.invoices}
                  total={results.invoices.length}
                  expanded={!!expanded.invoices}
                  onExpand={() => toggleExpand("invoices")}
                  renderItem={(inv) => (
                    <Row key={inv.id} onClick={() => navigate(`/jobs/${inv.jobId}`)}>
                      <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-yellow-400 text-xs font-black">$</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">
                          {inv.invoiceNumber}
                          <span className={`ml-2 text-xs font-normal ${INV_STATUS[inv.status]?.cls ?? "text-gray-400"}`}>
                            {INV_STATUS[inv.status]?.label ?? inv.status}
                          </span>
                        </p>
                        <p className="text-gray-500 text-xs truncate mt-0.5">
                          {[fmt(inv.totalAmount), inv.clientName ?? inv.jobName].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </Row>
                  )}
                />

              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
