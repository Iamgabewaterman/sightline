"use client";

import { useState, useEffect } from "react";
import type { CalcProps } from "./types";

const ic = "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-base rounded-xl px-4 py-4 w-full placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors min-h-[56px]";
const lc = "text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1 block";

interface CustomField {
  id: string;
  label: string;
  unit: string;
  type: "number" | "select";
  options?: string; // comma-separated for select
}

interface CustomCalcDef {
  id: string;
  name: string;
  fields: CustomField[];
  formula: string; // e.g. "{length} * {width} * 0.75"
  resultLabel: string;
  resultUnit: string;
  createdAt: number;
}

const LS_KEY = "sightline_custom_calcs";

function loadDefs(): CustomCalcDef[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch { return []; }
}

function saveDefs(defs: CustomCalcDef[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(defs));
}

function evalFormula(formula: string, values: Record<string, string>): number | null {
  try {
    // Replace {field_id} tokens with their values
    const expr = formula.replace(/\{([^}]+)\}/g, (_, key) => {
      const v = parseFloat(values[key] || "0");
      return isNaN(v) ? "0" : String(v);
    });
    // Safe math eval — allow only numbers, operators, spaces, parens, math functions
    if (!/^[\d\s\+\-\*\/\.\(\)%^]+$/.test(expr.replace(/Math\.\w+/g, "0"))) return null;
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    return typeof result === "number" && isFinite(result) ? result : null;
  } catch { return null; }
}

export default function CustomCalc({ jobs }: CalcProps) {
  const [defs, setDefs] = useState<CustomCalcDef[]>([]);
  const [mode, setMode] = useState<"list" | "build" | "run">("list");
  const [selectedDef, setSelectedDef] = useState<CustomCalcDef | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<number | null>(null);
  const [resultError, setResultError] = useState("");

  // Builder state
  const [bName,        setBName]        = useState("");
  const [bFields,      setBFields]      = useState<CustomField[]>([{ id: "field_1", label: "", unit: "", type: "number" }]);
  const [bFormula,     setBFormula]     = useState("");
  const [bResultLabel, setBResultLabel] = useState("Result");
  const [bResultUnit,  setBResultUnit]  = useState("");
  const [saveError,    setSaveError]    = useState("");

  useEffect(() => { setDefs(loadDefs()); }, []);

  function addField() {
    if (bFields.length >= 10) return;
    setBFields(f => [...f, { id: `field_${f.length + 1}`, label: "", unit: "", type: "number" }]);
  }

  function updateField(idx: number, key: keyof CustomField, val: string) {
    setBFields(f => f.map((field, i) => i === idx ? { ...field, [key]: val } : field));
  }

  function removeField(idx: number) {
    setBFields(f => f.filter((_, i) => i !== idx));
  }

  function saveCalc() {
    setSaveError("");
    if (!bName.trim()) { setSaveError("Name is required"); return; }
    if (bFields.some(f => !f.label.trim())) { setSaveError("All field labels are required"); return; }
    if (!bFormula.trim()) { setSaveError("Formula is required"); return; }

    const newDef: CustomCalcDef = {
      id: `custom_${Date.now()}`,
      name: bName.trim(),
      fields: bFields.map((f, i) => ({ ...f, id: f.label.toLowerCase().replace(/\s+/g, "_") || `field_${i+1}` })),
      formula: bFormula.trim(),
      resultLabel: bResultLabel || "Result",
      resultUnit: bResultUnit,
      createdAt: Date.now(),
    };
    const updated = [...defs, newDef];
    saveDefs(updated);
    setDefs(updated);
    setBName(""); setBFields([{ id: "field_1", label: "", unit: "", type: "number" }]);
    setBFormula(""); setBResultLabel("Result"); setBResultUnit("");
    setMode("list");
  }

  function deleteDef(id: string) {
    const updated = defs.filter(d => d.id !== id);
    saveDefs(updated);
    setDefs(updated);
  }

  function runCalc() {
    if (!selectedDef) return;
    const r = evalFormula(selectedDef.formula, fieldValues);
    if (r === null) { setResultError("Formula error — check your inputs"); setResult(null); }
    else { setResult(r); setResultError(""); }
  }

  function openRun(def: CustomCalcDef) {
    setSelectedDef(def);
    setFieldValues({});
    setResult(null);
    setResultError("");
    setMode("run");
  }

  // Token helper: extracts {token} from formula (Array.from for TS compat)
  const formulaTokens = (f: string) => Array.from(f.matchAll(/\{([^}]+)\}/g)).map(m => m[1]);

  if (mode === "run" && selectedDef) return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => setMode("list")} className="text-gray-500 text-sm">← Back</button>
        <h3 className="text-white font-bold flex-1">{selectedDef.name}</h3>
      </div>

      {selectedDef.fields.map(field => (
        <div key={field.id}>
          <label className={lc}>{field.label}{field.unit ? ` (${field.unit})` : ""}</label>
          {field.type === "select" && field.options ? (
            <div className="flex gap-2 flex-wrap">
              {field.options.split(",").map(opt => (
                <button key={opt.trim()} onClick={() => setFieldValues(v => ({ ...v, [field.id]: opt.trim() }))}
                  className={`flex-none px-4 py-3 rounded-xl text-sm font-semibold border transition-colors ${fieldValues[field.id] === opt.trim() ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`}>
                  {opt.trim()}
                </button>
              ))}
            </div>
          ) : (
            <input className={ic} type="number" inputMode="decimal" placeholder="0" value={fieldValues[field.id] || ""} onChange={e => setFieldValues(v => ({ ...v, [field.id]: e.target.value }))} />
          )}
        </div>
      ))}

      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
        <p className="text-gray-600 text-xs font-mono">{selectedDef.formula}</p>
      </div>

      {result !== null && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl px-4 py-4">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{selectedDef.resultLabel}</p>
          <p className="text-white font-black text-3xl mt-1">{result % 1 === 0 ? result : result.toFixed(3)} <span className="text-orange-400 text-lg">{selectedDef.resultUnit}</span></p>
        </div>
      )}
      {resultError && <p className="text-red-400 text-sm">{resultError}</p>}

      <button onClick={runCalc} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform">Calculate</button>
    </div>
  );

  if (mode === "build") return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => setMode("list")} className="text-gray-500 text-sm">← Back</button>
        <h3 className="text-white font-bold flex-1">Build Calculator</h3>
      </div>

      <div>
        <label className={lc}>Calculator Name</label>
        <input className={ic} placeholder="e.g. Fence Board Count" value={bName} onChange={e => setBName(e.target.value)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={lc}>Input Fields</label>
          {bFields.length < 10 && <button onClick={addField} className="text-orange-400 text-xs font-bold">+ Add Field</button>}
        </div>
        <div className="flex flex-col gap-2">
          {bFields.map((field, idx) => (
            <div key={idx} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <input className={ic} placeholder="Field label" value={field.label} onChange={e => updateField(idx, "label", e.target.value)} />
                <input className={ic} placeholder="Unit (ft, sq yd…)" value={field.unit} onChange={e => updateField(idx, "unit", e.target.value)} />
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex gap-2 flex-1">
                  <button onClick={() => updateField(idx, "type", "number")} className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${field.type === "number" ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`}>Number</button>
                  <button onClick={() => updateField(idx, "type", "select")} className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${field.type === "select" ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`}>Dropdown</button>
                </div>
                {bFields.length > 1 && <button onClick={() => removeField(idx)} className="text-gray-600 text-xs px-2 py-2 hover:text-red-400">✕</button>}
              </div>
              {field.type === "select" && (
                <input className={ic} placeholder="Options: opt1, opt2, opt3 (comma-separated)" value={field.options || ""} onChange={e => updateField(idx, "options", e.target.value)} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className={lc}>Formula</label>
        <input className={ic} placeholder={`e.g. {${bFields[0]?.label?.toLowerCase().replace(/\s+/g,"_") || "length"}} * {${bFields[1]?.label?.toLowerCase().replace(/\s+/g,"_") || "width"}}`} value={bFormula} onChange={e => setBFormula(e.target.value)} />
        <p className="text-gray-600 text-xs mt-1">Use {"{field_label}"} tokens. Supports + - * / ( ) and Math.ceil/floor/sqrt/round. Example: {"{length}"} * {"{width}"} * 1.10</p>
        {bFormula && (
          <div className="mt-1 flex flex-wrap gap-1">
            {bFields.filter(f => f.label).map(f => (
              <button key={f.id} onClick={() => setBFormula(prev => prev + `{${f.label.toLowerCase().replace(/\s+/g,"_")}}`)}
                className="bg-[#1A1A1A] border border-[#2a2a2a] text-orange-400 text-xs px-2 py-1 rounded-lg font-mono">
                +{`{${f.label.toLowerCase().replace(/\s+/g,"_")}}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lc}>Result Label</label>
          <input className={ic} placeholder="Total boards" value={bResultLabel} onChange={e => setBResultLabel(e.target.value)} />
        </div>
        <div>
          <label className={lc}>Result Unit</label>
          <input className={ic} placeholder="ea, sqft, LF…" value={bResultUnit} onChange={e => setBResultUnit(e.target.value)} />
        </div>
      </div>

      {saveError && <p className="text-red-400 text-sm">{saveError}</p>}

      <button onClick={saveCalc} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform">Save Calculator</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {defs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-4xl mb-3">🔧</p>
          <p className="text-white font-bold mb-1">No custom calculators yet</p>
          <p className="text-gray-500 text-sm">Build your own calculator with custom inputs and formulas.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {defs.map(def => (
            <div key={def.id} className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold">{def.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">{def.fields.length} input{def.fields.length !== 1 ? "s" : ""} · {def.resultLabel}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => deleteDef(def.id)} className="text-gray-600 text-xs p-2 hover:text-red-400 transition-colors">✕</button>
                <button onClick={() => openRun(def)} className="bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-sm active:scale-95">Use</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setMode("build")} className="bg-[#1A1A1A] border border-dashed border-[#3a3a3a] text-gray-300 font-bold py-5 rounded-2xl text-sm active:scale-95 transition-transform">
        + Build My Own Calculator
      </button>
    </div>
  );
}
