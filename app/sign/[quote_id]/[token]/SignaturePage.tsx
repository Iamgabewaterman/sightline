"use client";

import { useRef, useState, useEffect } from "react";
import { submitSignature } from "@/app/actions/quotes";

const JOB_TYPE_LABELS: Record<string, string> = {
  drywall: "Drywall", framing: "Framing", plumbing: "Plumbing",
  paint: "Paint", trim: "Trim", roofing: "Roofing", tile: "Tile",
  flooring: "Flooring", electrical: "Electrical", hvac: "HVAC",
  concrete: "Concrete", landscaping: "Landscaping", decks_patios: "Decks & Patios",
};

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

// ── Signature Pad ────────────────────────────────────────────────────────────

function SignaturePad({
  onHasSignature,
  canvasRef,
}: {
  onHasSignature: (has: boolean) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}) {
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  function getPos(e: MouseEvent | Touch, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (('clientX' in e ? e.clientX : 0) - rect.left) * (canvas.width / rect.width),
      y: (('clientY' in e ? e.clientY : 0) - rect.top) * (canvas.height / rect.height),
    };
  }

  function checkEmpty(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) return false;
    }
    return true;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Mouse events
    function onMouseDown(e: MouseEvent) {
      e.preventDefault();
      isDrawing.current = true;
      lastPos.current = getPos(e, canvas!);
    }
    function onMouseMove(e: MouseEvent) {
      if (!isDrawing.current || !lastPos.current) return;
      const pos = getPos(e, canvas!);
      ctx!.beginPath();
      ctx!.moveTo(lastPos.current.x, lastPos.current.y);
      ctx!.lineTo(pos.x, pos.y);
      ctx!.stroke();
      lastPos.current = pos;
      onHasSignature(!checkEmpty(canvas!));
    }
    function onMouseUp() {
      isDrawing.current = false;
      lastPos.current = null;
    }

    // Touch events
    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      isDrawing.current = true;
      lastPos.current = getPos(e.touches[0], canvas!);
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (!isDrawing.current || !lastPos.current) return;
      const pos = getPos(e.touches[0], canvas!);
      ctx!.beginPath();
      ctx!.moveTo(lastPos.current.x, lastPos.current.y);
      ctx!.lineTo(pos.x, pos.y);
      ctx!.stroke();
      lastPos.current = pos;
      onHasSignature(!checkEmpty(canvas!));
    }
    function onTouchEnd() {
      isDrawing.current = false;
      lastPos.current = null;
    }

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [canvasRef, onHasSignature]);

  return null;
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SignaturePage({
  estimateId,
  token,
  jobName,
  jobAddress,
  jobTypes,
  materialsTotal,
  laborTotal,
  profitMarginPct,
  profitAmount,
  addons,
  grandTotal,
  businessName,
  licenseNumber,
  logoUrl,
}: {
  estimateId: string;
  token: string;
  jobName: string;
  jobAddress: string;
  jobTypes: string[];
  materialsTotal: number;
  laborTotal: number;
  profitMarginPct: number;
  profitAmount: number;
  addons: { name: string; amount: number }[];
  grandTotal: number;
  businessName: string | null;
  licenseNumber: string | null;
  logoUrl: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const validAddons = addons.filter((a) => a.name && a.amount !== 0);
  const displayName = businessName ?? "Your Contractor";

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function handleSubmit() {
    if (!hasSignature) { setError("Please sign above."); return; }
    if (!name.trim()) { setError("Please enter your full name."); return; }
    setError("");
    setSubmitting(true);

    const signatureData = canvasRef.current?.toDataURL("image/png") ?? "";

    const result = await submitSignature({
      estimateId,
      token,
      signedByName: name.trim(),
      signatureData,
    });

    setSubmitting(false);
    if (result.error) { setError(result.error); return; }
    setSubmitted(true);
  }

  // ── Confirmation screen ──────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Quote Accepted</h1>
          <p className="text-gray-600 text-base leading-relaxed">
            {displayName} will be in touch shortly. A copy has been saved.
          </p>
        </div>
      </div>
    );
  }

  // ── Signature form ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 pb-16">

        {/* Business header */}
        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-6 mb-4">
          <div className="flex items-start gap-4 mb-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain shrink-0" />
            ) : (
              <div className="shrink-0">
                <p className="text-xl font-black text-[#F97316] leading-tight">{displayName.toUpperCase()}</p>
                {licenseNumber && (
                  <p className="text-xs text-gray-400 mt-0.5">License # {licenseNumber}</p>
                )}
              </div>
            )}
            {logoUrl && businessName && (
              <div>
                <p className="font-bold text-gray-900 text-base">{businessName}</p>
                {licenseNumber && (
                  <p className="text-xs text-gray-400 mt-0.5">License # {licenseNumber}</p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Quote for</p>
            <h1 className="text-2xl font-black text-gray-900 leading-tight">{jobName}</h1>
            {jobAddress && <p className="text-sm text-gray-500 mt-1">{jobAddress}</p>}
            {jobTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {jobTypes.map((t) => (
                  <span key={t} className="text-[#F97316] text-xs bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full font-semibold">
                    {JOB_TYPE_LABELS[t] ?? t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quote line items */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          <div className="px-6 py-4 flex flex-col gap-3">
            {materialsTotal > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Materials</span>
                <span className="text-gray-900 font-semibold">{fmt(materialsTotal)}</span>
              </div>
            )}
            {laborTotal > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Labor</span>
                <span className="text-gray-900 font-semibold">{fmt(laborTotal)}</span>
              </div>
            )}
            {validAddons.map((a, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">{a.name}</span>
                <span className="text-gray-900 font-semibold">
                  {a.amount < 0 ? "−" : "+"}{fmt(Math.abs(a.amount))}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center border-t border-gray-100 pt-3">
              <span className="text-gray-500 text-sm">Profit ({profitMarginPct}%)</span>
              <span className="text-[#F97316] font-semibold text-sm">+{fmt(profitAmount)}</span>
            </div>
          </div>
          <div className="bg-gray-50 border-t border-gray-100 px-6 py-5 flex justify-between items-center">
            <span className="text-gray-900 font-black text-xl uppercase tracking-wide">Total</span>
            <span className="text-[#F97316] font-black text-4xl leading-none">{fmt(grandTotal)}</span>
          </div>
        </div>

        {/* Prepared by */}
        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-4 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Prepared by</p>
          <p className="text-gray-900 font-semibold">{displayName}</p>
          {licenseNumber && (
            <p className="text-gray-500 text-sm">License # {licenseNumber}</p>
          )}
        </div>

        {/* Agreement + Signature */}
        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-6 mb-4">
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            By signing below you agree to the scope of work and total amount shown above.
          </p>

          {/* Signature pad */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Signature
              </label>
              <button
                type="button"
                onClick={clearSignature}
                className="text-xs text-gray-400 font-semibold active:text-gray-700 min-h-[36px] px-2"
              >
                Clear
              </button>
            </div>
            <div className="relative rounded-xl border-2 border-dashed border-gray-200 overflow-hidden bg-white">
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-gray-300 text-sm font-medium select-none">Sign here</p>
                </div>
              )}
              <canvas
                ref={canvasRef}
                width={600}
                height={180}
                className="w-full touch-none"
                style={{ display: "block" }}
              />
              <SignaturePad canvasRef={canvasRef} onHasSignature={setHasSignature} />
            </div>
          </div>

          {/* Name input */}
          <div className="mt-5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
              Full Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full border border-gray-200 rounded-xl px-4 py-4 text-gray-900 text-base placeholder:text-gray-300 focus:outline-none focus:border-[#F97316] transition-colors"
            />
          </div>

          {error && (
            <p className="mt-3 text-red-500 text-sm">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-5 w-full bg-[#F97316] text-white font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Sign and Accept Quote"}
          </button>
        </div>

        <p className="text-center text-gray-400 text-xs">
          Powered by Sightline · sightline.one
        </p>
      </div>
    </div>
  );
}
