"use client";

import { useRef, useState, useEffect, useCallback } from "react";

type Tool = "draw" | "circle" | "arrow";

type Stroke =
  | { type: "draw"; points: [number, number][] }
  | { type: "circle"; x1: number; y1: number; x2: number; y2: number }
  | { type: "arrow"; x1: number; y1: number; x2: number; y2: number };

type Box = { left: number; top: number; w: number; h: number; cw: number; ch: number };

const ORANGE = "#F97316";
const LINE_W = 3; // CSS pixels

export default function PhotoMarkupEditor({
  file,
  onDone,
}: {
  file: File;
  /** Called with the marked-up File (Confirm) or original File (Skip / no strokes) */
  onDone: (file: File) => void;
}) {
  const srcUrl    = useRef(URL.createObjectURL(file));
  const imgRef    = useRef<HTMLImageElement>(null);
  const areaRef   = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool]           = useState<Tool>("draw");
  const [strokeCount, setStrokeCount] = useState(0);
  const [confirming, setConfirming]   = useState(false);
  const [box, setBox]             = useState<Box | null>(null);

  // Refs for the RAF loop — no React re-renders during drawing
  const boxRef      = useRef<Box | null>(null);
  const strokesRef  = useRef<Stroke[]>([]);
  const currentRef  = useRef<Stroke | null>(null);
  const drawingRef  = useRef(false);
  const dirtyRef    = useRef(false);
  const rafRef      = useRef<number | null>(null);

  // Release blob URL on unmount
  useEffect(() => {
    const url = srcUrl.current;
    return () => URL.revokeObjectURL(url);
  }, []);

  // Measure the exact rendered rect of the image inside the flex container
  const measureBox = useCallback(() => {
    const img  = imgRef.current;
    const area = areaRef.current;
    if (!img || !area || !img.naturalWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const aw = area.clientWidth;
    const ah = area.clientHeight;
    const ia = img.naturalWidth / img.naturalHeight;
    let w: number, h: number;
    if (ia > aw / ah) { w = aw; h = aw / ia; }
    else               { h = ah; w = ah * ia; }
    const b: Box = {
      left: (aw - w) / 2, top: (ah - h) / 2,
      w: Math.round(w), h: Math.round(h),
      cw: Math.round(w * dpr), ch: Math.round(h * dpr),
    };
    boxRef.current = b;
    setBox(b);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", measureBox);
    return () => window.removeEventListener("resize", measureBox);
  }, [measureBox]);

  // RAF render loop — runs while box is known
  useEffect(() => {
    if (!box) return;
    function loop() {
      if (dirtyRef.current) { paint(); dirtyRef.current = false; }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [box]); // eslint-disable-line react-hooks/exhaustive-deps

  function paint() {
    const canvas = canvasRef.current;
    const b = boxRef.current;
    if (!canvas || !b) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, b.w, b.h);
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth   = LINE_W;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";

    for (const s of strokesRef.current) drawStroke(ctx, s);
    if (currentRef.current) drawStroke(ctx, currentRef.current);
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    if (s.type === "draw") {
      if (s.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(s.points[0][0], s.points[0][1]);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i][0], s.points[i][1]);
      ctx.stroke();
    } else if (s.type === "circle") {
      const cx = (s.x1 + s.x2) / 2;
      const cy = (s.y1 + s.y2) / 2;
      const r  = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / 2;
      if (r < 3) return;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      drawArrow(ctx, s.x1, s.y1, s.x2, s.y2, 1);
    }
  }

  function drawArrow(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number,
    x2: number, y2: number,
    scale: number
  ) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 8 * scale) return;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head  = Math.min(18 * scale, len * 0.35);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  function getPos(e: React.PointerEvent): [number, number] {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const [x, y] = getPos(e);
    if (tool === "draw")        currentRef.current = { type: "draw",   points: [[x, y]] };
    else if (tool === "circle") currentRef.current = { type: "circle", x1: x, y1: y, x2: x, y2: y };
    else                        currentRef.current = { type: "arrow",  x1: x, y1: y, x2: x, y2: y };
    dirtyRef.current = true;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawingRef.current || !currentRef.current) return;
    e.preventDefault();
    const [x, y] = getPos(e);
    const cur = currentRef.current;
    if (cur.type === "draw") {
      cur.points.push([x, y]);
    } else {
      cur.x2 = x;
      cur.y2 = y;
    }
    dirtyRef.current = true;
  }

  function commitOrDiscard() {
    drawingRef.current = false;
    const cur = currentRef.current;
    if (!cur) return;
    let ok = false;
    if (cur.type === "draw")   ok = cur.points.length >= 3;
    else if (cur.type === "circle") ok = Math.hypot(cur.x2 - cur.x1, cur.y2 - cur.y1) / 2 >= 5;
    else                            ok = Math.hypot(cur.x2 - cur.x1, cur.y2 - cur.y1) >= 10;
    if (ok) {
      strokesRef.current = [...strokesRef.current, cur];
      setStrokeCount(strokesRef.current.length);
    }
    currentRef.current = null;
    dirtyRef.current = true;
  }

  function handleUndo() {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    dirtyRef.current = true;
  }

  async function handleConfirm() {
    if (strokesRef.current.length === 0) { onDone(file); return; }
    setConfirming(true);
    try {
      const img = imgRef.current;
      const b   = boxRef.current;
      if (!img || !b) { onDone(file); return; }

      const off = document.createElement("canvas");
      off.width  = img.naturalWidth;
      off.height = img.naturalHeight;
      const ctx  = off.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      const sx = img.naturalWidth  / b.w;
      const sy = img.naturalHeight / b.h;
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth   = LINE_W * sx;
      ctx.lineCap     = "round";
      ctx.lineJoin    = "round";

      for (const s of strokesRef.current) {
        if (s.type === "draw") {
          if (s.points.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(s.points[0][0] * sx, s.points[0][1] * sy);
          for (let i = 1; i < s.points.length; i++)
            ctx.lineTo(s.points[i][0] * sx, s.points[i][1] * sy);
          ctx.stroke();
        } else if (s.type === "circle") {
          const cx = (s.x1 + s.x2) / 2 * sx;
          const cy = (s.y1 + s.y2) / 2 * sy;
          const r  = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / 2 * sx;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          drawArrow(ctx, s.x1 * sx, s.y1 * sy, s.x2 * sx, s.y2 * sy, sx);
        }
      }

      off.toBlob(
        (blob) => {
          if (!blob) { onDone(file); return; }
          onDone(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92
      );
    } catch {
      onDone(file);
    }
  }

  const activeCls   = "bg-orange-500/20 text-orange-400 border border-orange-500/40";
  const inactiveCls = "text-gray-400 border border-transparent";

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col" style={{ touchAction: "none" }}>
      {/* Top bar */}
      <div
        className="shrink-0 flex items-center justify-between px-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)", paddingBottom: 14 }}
      >
        <p className="text-white text-sm font-bold">Mark Up Photo</p>
        <button
          onClick={() => onDone(file)}
          className="text-gray-400 text-sm font-semibold px-3 py-2 active:opacity-70"
        >
          Skip Markup
        </button>
      </div>

      {/* Image area */}
      <div ref={areaRef} className="flex-1 relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={srcUrl.current}
          alt=""
          className="absolute inset-0 w-full h-full object-contain select-none"
          onLoad={measureBox}
          draggable={false}
        />
        {box && (
          <canvas
            ref={canvasRef}
            width={box.cw}
            height={box.ch}
            style={{
              position: "absolute",
              left: box.left,
              top: box.top,
              width: box.w,
              height: box.h,
              touchAction: "none",
              cursor: "crosshair",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={commitOrDiscard}
            onPointerCancel={commitOrDiscard}
          />
        )}
      </div>

      {/* Bottom toolbar */}
      <div
        className="shrink-0 bg-[#141414] border-t border-[#2a2a2a] flex items-center gap-2 px-4"
        style={{ paddingTop: 12, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <button
          onClick={() => setTool("draw")}
          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors active:scale-95 ${tool === "draw" ? activeCls : inactiveCls}`}
        >
          <PenIcon />Draw
        </button>
        <button
          onClick={() => setTool("circle")}
          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors active:scale-95 ${tool === "circle" ? activeCls : inactiveCls}`}
        >
          <CircleIcon />Circle
        </button>
        <button
          onClick={() => setTool("arrow")}
          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors active:scale-95 ${tool === "arrow" ? activeCls : inactiveCls}`}
        >
          <ArrowIcon />Arrow
        </button>
        <button
          onClick={handleUndo}
          disabled={strokeCount === 0}
          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors active:scale-95 disabled:opacity-40 ${inactiveCls}`}
        >
          <UndoIcon />Undo
        </button>
        <div className="flex-1" />
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="bg-orange-500 text-white font-bold text-sm px-5 py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 shrink-0"
        >
          {confirming ? "Saving…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}

function PenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 13.5-13.5z" />
    </svg>
  );
}
function CircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="19" x2="19" y2="5" /><polyline points="13 5 19 5 19 11" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 00-4-4H4" />
    </svg>
  );
}
