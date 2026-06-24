"use client";

import { createContext, useContext, useState, useEffect } from "react";

// ── Unit system ─────────────────────────────────────────────────────────────
// Calculators do their math in decimal FEET. DimensionInput is the single place
// that converts native feet+inches (or metric) entry to a decimal-feet string,
// so every existing calc keeps working unchanged — it still receives a number.

export type Unit = "imperial" | "metric";

const UnitCtx = createContext<{ unit: Unit; setUnit: (u: Unit) => void }>({
  unit: "imperial",
  setUnit: () => {},
});

export function UnitProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnit] = useState<Unit>("imperial");
  return <UnitCtx.Provider value={{ unit, setUnit }}>{children}</UnitCtx.Provider>;
}

export function useUnit() {
  return useContext(UnitCtx);
}

const FT_PER_M = 3.280839895;

export function UnitToggle() {
  const { unit, setUnit } = useUnit();
  const btn = (active: boolean) =>
    `px-4 py-2 rounded-lg text-xs font-bold border transition-colors active:scale-95 ${
      active ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-gray-400 border-[#2a2a2a]"
    }`;
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mr-1">Units</span>
      <button onClick={() => setUnit("imperial")} className={btn(unit === "imperial")}>Imperial (ft/in)</button>
      <button onClick={() => setUnit("metric")} className={btn(unit === "metric")}>Metric (m)</button>
    </div>
  );
}

const fieldCls =
  "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-base rounded-xl px-3 py-4 w-full placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors min-h-[56px]";

/**
 * Native dimension input. Canonical value is a decimal-FEET string (so it's a
 * drop-in for the old `<input value={x} onChange={e=>setX(e.target.value)} />`).
 * - Imperial: side-by-side Feet + Inches, with a "decimal" toggle for those who
 *   prefer entering 12.5 ft directly.
 * - Metric: meters input, converted to feet under the hood.
 */
export function DimensionInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (decimalFeet: string) => void;
  placeholder?: string;
}) {
  const { unit } = useUnit();
  const [mode, setMode] = useState<"ftin" | "dec">("ftin");
  const [ft, setFt] = useState("");
  const [inch, setInch] = useState("");
  const [dec, setDec] = useState("");
  const [metric, setMetric] = useState("");

  // Resync local fields when the parent clears the value (e.g. after a calc).
  useEffect(() => {
    if (value === "") {
      setFt(""); setInch(""); setDec(""); setMetric("");
    }
  }, [value]);

  function round(d: number) {
    return d ? String(Math.round(d * 10000) / 10000) : "";
  }
  function emitFtIn(f: string, i: string) {
    onChange(round((parseFloat(f) || 0) + (parseFloat(i) || 0) / 12));
  }

  if (unit === "metric") {
    return (
      <input
        className={fieldCls}
        type="number"
        inputMode="decimal"
        placeholder={placeholder ? `${placeholder} (m)` : "meters"}
        value={metric}
        onChange={(e) => {
          setMetric(e.target.value);
          onChange(round((parseFloat(e.target.value) || 0) * FT_PER_M));
        }}
      />
    );
  }

  if (mode === "dec") {
    return (
      <div className="flex gap-2 items-stretch">
        <div className="relative flex-1">
          <input
            className={fieldCls}
            type="number"
            inputMode="decimal"
            placeholder={placeholder ? `${placeholder} (ft)` : "decimal ft"}
            value={dec}
            onChange={(e) => { setDec(e.target.value); onChange(e.target.value); }}
          />
        </div>
        <button
          type="button"
          onClick={() => setMode("ftin")}
          className="shrink-0 px-3 rounded-xl border border-[#2a2a2a] text-gray-500 text-[10px] font-bold uppercase active:scale-95"
          title="Switch to feet & inches"
        >
          ft/in
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-stretch">
      <div className="relative flex-1">
        <input
          className={fieldCls}
          type="number"
          inputMode="numeric"
          placeholder={placeholder ?? "ft"}
          value={ft}
          onChange={(e) => { setFt(e.target.value); emitFtIn(e.target.value, inch); }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs pointer-events-none">ft</span>
      </div>
      <div className="relative flex-1">
        <input
          className={fieldCls}
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={inch}
          onChange={(e) => { setInch(e.target.value); emitFtIn(ft, e.target.value); }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs pointer-events-none">in</span>
      </div>
      <button
        type="button"
        onClick={() => setMode("dec")}
        className="shrink-0 px-2 rounded-xl border border-[#2a2a2a] text-gray-500 text-[10px] font-bold uppercase active:scale-95"
        title="Switch to decimal feet"
      >
        .0
      </button>
    </div>
  );
}
