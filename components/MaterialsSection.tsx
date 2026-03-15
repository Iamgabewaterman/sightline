"use client";

import { useState, useRef } from "react";
import { addMaterial, updateMaterial, deleteMaterial } from "@/app/actions/materials";
import { Material } from "@/types";

function fmt(n: number | null, prefix = "") {
  if (n === null || n === undefined) return "—";
  return prefix + n.toString();
}

function MaterialRow({
  material,
  onUpdate,
  onDelete,
}: {
  material: Material;
  onUpdate: (id: string, fields: Partial<Material>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [usedVal, setUsedVal] = useState(material.quantity_used?.toString() ?? "");
  const [costVal, setCostVal] = useState(material.unit_cost?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    const quantity_used = usedVal !== "" ? parseFloat(usedVal) : null;
    const unit_cost = costVal !== "" ? parseFloat(costVal) : null;
    const result = await updateMaterial(material.id, { quantity_used, unit_cost });
    if (result.error) {
      setError(result.error);
    } else {
      onUpdate(material.id, { quantity_used, unit_cost });
      setEditing(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Remove "${material.name}"?`)) return;
    await deleteMaterial(material.id);
    onDelete(material.id);
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-4">
      {/* Name + unit */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-white font-semibold text-base">{material.name}</span>
          <span className="text-gray-400 text-sm ml-2">({material.unit})</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing((e) => !e)}
            className="text-gray-400 text-sm px-4 py-3 rounded-xl border border-gray-700 active:scale-95 transition-transform"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            onClick={handleDelete}
            className="text-red-400 text-sm px-4 py-3 rounded-xl border border-gray-800 active:scale-95 transition-transform"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-700 rounded-lg py-2">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Ordered</p>
          <p className="text-white font-semibold">{material.quantity_ordered}</p>
        </div>
        <div className="bg-gray-700 rounded-lg py-2">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Used</p>
          <p className={`font-semibold ${material.quantity_used !== null ? "text-white" : "text-gray-600"}`}>
            {fmt(material.quantity_used)}
          </p>
        </div>
        <div className="bg-gray-700 rounded-lg py-2">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Unit Cost</p>
          <p className={`font-semibold ${material.unit_cost !== null ? "text-orange-500" : "text-gray-600"}`}>
            {fmt(material.unit_cost, "$")}
          </p>
        </div>
      </div>

      {/* Edit mode */}
      {editing && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Used</label>
              <input
                type="number"
                min="0"
                step="any"
                value={usedVal}
                onChange={(e) => setUsedVal(e.target.value)}
                placeholder="0"
                className="w-full mt-1 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-3 text-base focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Unit Cost $</label>
              <input
                type="number"
                min="0"
                step="any"
                value={costVal}
                onChange={(e) => setCostVal(e.target.value)}
                placeholder="0.00"
                className="w-full mt-1 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-3 text-base focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            onClick={save}
            disabled={saving}
            className="bg-orange-500 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function MaterialsSection({
  jobId,
  initialMaterials,
}: {
  jobId: string;
  initialMaterials: Material[];
}) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const formData = new FormData(e.currentTarget);
    const result = await addMaterial(jobId, formData);

    if (result.error) {
      setFormError(result.error);
    } else if (result.material) {
      setMaterials((prev) => [result.material as Material, ...prev]);
      formRef.current?.reset();
      setShowForm(false);
    }
    setSaving(false);
  }

  function handleUpdate(id: string, fields: Partial<Material>) {
    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...fields } : m))
    );
  }

  function handleDelete(id: string) {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-xl">Materials</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-white font-semibold text-sm bg-gray-800 border border-gray-700 px-4 py-3 rounded-xl active:scale-95 transition-transform"
        >
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form
          ref={formRef}
          onSubmit={handleAdd}
          className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 mb-4 flex flex-col gap-3"
        >
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">New Material</p>

          <input
            name="name"
            type="text"
            required
            placeholder="Material name (e.g. Drywall 5/8&quot; 4x8)"
            className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-4 text-base placeholder:text-gray-500 focus:outline-none focus:border-orange-500"
          />

          <input
            name="unit"
            type="text"
            required
            placeholder="Unit (sheets, studs, bags, rolls, lbs...)"
            className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-4 text-base placeholder:text-gray-500 focus:outline-none focus:border-orange-500"
          />

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Ordered *</label>
              <input
                name="quantity_ordered"
                type="number"
                min="0"
                step="any"
                required
                placeholder="0"
                className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Used</label>
              <input
                name="quantity_used"
                type="number"
                min="0"
                step="any"
                placeholder="Fill in later"
                className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-4 text-base placeholder:text-gray-500 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs uppercase tracking-wider">Unit Cost $</label>
            <input
              name="unit_cost"
              type="number"
              min="0"
              step="any"
              placeholder="0.00 — fill in from receipt later"
              className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-4 text-base placeholder:text-gray-500 focus:outline-none focus:border-orange-500"
            />
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
            {saving ? "Adding..." : "Add Material"}
          </button>
        </form>
      )}

      {/* Materials list */}
      {materials.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl py-10 text-center">
          <p className="text-gray-500 text-sm">No materials logged yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {materials.map((m) => (
            <MaterialRow
              key={m.id}
              material={m}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
