"use client";

import { useState, useRef, useEffect } from "react";
import { addLaborLog, updateLaborLog, deleteLaborLog } from "@/app/actions/labor";
import { LaborLog } from "@/types";
import { useJobCost } from "@/components/JobCostContext";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function LaborSection({
  jobId,
  initialLogs,
}: {
  jobId: string;
  initialLogs: LaborLog[];
}) {
  const [logs, setLogs] = useState<LaborLog[]>(initialLogs);
  const { setActualLaborCost } = useJobCost();

  useEffect(() => {
    const cost = logs.reduce((s, l) => s + Number(l.hours) * Number(l.rate), 0);
    setActualLaborCost(cost);
  }, [logs, setActualLaborCost]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editError, setEditError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const fd = new FormData(e.currentTarget);
    const result = await addLaborLog(jobId, fd);

    if (result.error) {
      setFormError(result.error);
    } else if (result.log) {
      setLogs((prev) => [result.log!, ...prev]);
      formRef.current?.reset();
      setShowForm(false);
    }
    setSaving(false);
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setSaving(true);
    setEditError("");

    const fd = new FormData(e.currentTarget);
    const result = await updateLaborLog(id, fd);

    if (result.error) {
      setEditError(result.error);
    } else if (result.log) {
      setLogs((prev) => prev.map((l) => (l.id === id ? result.log! : l)));
      setEditingId(null);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this labor entry?")) return;
    await deleteLaborLog(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  const totalHours = logs.reduce((s, l) => s + Number(l.hours), 0);
  const totalCost = logs.reduce(
    (s, l) => s + Number(l.hours) * Number(l.rate),
    0
  );

  const inputClass =
    "bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500";

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-xl">Labor</h2>
        <div className="flex items-center gap-3">
          {logs.length > 0 && (
            <span className="text-orange-500 font-bold text-base">
              ${Math.round(totalCost).toLocaleString()}
            </span>
          )}
          <button
            onClick={() => { setShowForm((s) => !s); setFormError(""); }}
            className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform"
          >
            {showForm ? "Cancel" : "+ Log"}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form
          ref={formRef}
          onSubmit={handleAdd}
          className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4 flex flex-col gap-3"
        >
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
            Log Labor
          </p>
          <input
            name="crew_name"
            type="text"
            required
            placeholder="Crew name (e.g. Mike, Sub crew, You)"
            className={inputClass}
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Hours</label>
              <input
                name="hours"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                required
                placeholder="8"
                className={inputClass}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Rate $/hr</label>
              <input
                name="rate"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                required
                placeholder="35"
                className={inputClass}
              />
            </div>
          </div>
          {formError && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="bg-orange-500 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Labor Entry"}
          </button>
        </form>
      )}

      {/* Log list */}
      {logs.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
          <p className="text-gray-500 text-sm">No labor logged yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => {
            const lineTotal = Number(log.hours) * Number(log.rate);
            const isEditing = editingId === log.id;

            if (isEditing) {
              return (
                <form
                  key={log.id}
                  onSubmit={(e) => handleEdit(e, log.id)}
                  className="bg-[#1A1A1A] border border-orange-500/40 rounded-xl px-4 py-4 flex flex-col gap-3"
                >
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    Edit Labor Entry
                  </p>
                  <input
                    name="crew_name"
                    type="text"
                    required
                    defaultValue={log.crew_name}
                    className={inputClass}
                  />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-gray-400 text-xs uppercase tracking-wider">Hours</label>
                      <input
                        name="hours"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.5"
                        required
                        defaultValue={Number(log.hours)}
                        className={inputClass}
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-gray-400 text-xs uppercase tracking-wider">Rate $/hr</label>
                      <input
                        name="rate"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        required
                        defaultValue={Number(log.rate)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  {editError && (
                    <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
                      {editError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingId(null); setEditError(""); }}
                      className="px-5 py-4 bg-[#242424] text-gray-400 font-semibold rounded-xl active:scale-95 transition-transform"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div
                key={log.id}
                className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-semibold text-base">{log.crew_name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{formatDate(log.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingId(log.id); setShowForm(false); setEditError(""); }}
                      className="text-gray-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(log.id)}
                      className="text-red-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#242424] rounded-lg py-2">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Hours</p>
                    <p className="text-white font-semibold">{Number(log.hours)}</p>
                  </div>
                  <div className="bg-[#242424] rounded-lg py-2">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Rate</p>
                    <p className="text-white font-semibold">${Number(log.rate)}/hr</p>
                  </div>
                  <div className="bg-[#242424] rounded-lg py-2">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Total</p>
                    <p className="text-orange-500 font-bold">
                      ${Math.round(lineTotal).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Summary */}
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Total hours</span>
              <span className="text-white font-semibold">{totalHours.toFixed(1)} hrs</span>
            </div>
            <div className="flex justify-between text-sm border-t border-[#2a2a2a] pt-2">
              <span className="text-gray-400">Total labor cost</span>
              <span className="text-white font-bold text-base">
                ${Math.round(totalCost).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
