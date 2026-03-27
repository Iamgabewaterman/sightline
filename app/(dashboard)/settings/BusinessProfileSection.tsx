"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { BusinessProfile, PaymentTerms } from "@/types";
import { upsertBusinessProfile, uploadBusinessLogo } from "@/app/actions/business-profile";

const inputCls =
  "bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 w-full disabled:opacity-50 disabled:cursor-default";

const PAYMENT_TERM_LABELS: Record<PaymentTerms, string> = {
  due_on_receipt: "Due on Receipt",
  net_15: "Net 15",
  net_30: "Net 30",
  net_45: "Net 45",
};

export default function BusinessProfileSection({
  initial,
}: {
  initial: BusinessProfile | null;
}) {
  const hasData = !!(initial?.business_name || initial?.owner_name);
  const [editing, setEditing] = useState(!hasData);

  const [businessName, setBusinessName] = useState(initial?.business_name ?? "");
  const [ownerName, setOwnerName] = useState(initial?.owner_name ?? "");
  const [licenseNumber, setLicenseNumber] = useState(initial?.license_number ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState<PaymentTerms>(initial?.default_payment_terms ?? "net_30");
  const [logoPath, setLogoPath] = useState(initial?.logo_path ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load signed URL for existing logo
  useEffect(() => {
    if (initial?.logo_path) {
      const supabase = createClient();
      supabase.storage
        .from("business-logos")
        .createSignedUrl(initial.logo_path, 3600)
        .then(({ data }) => { if (data) setLogoUrl(data.signedUrl); });
    }
  }, [initial?.logo_path]);

  function showToast(text: string, ok: boolean) {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const res = await uploadBusinessLogo(file);
    if (res.error) { showToast(res.error, false); setLogoUploading(false); return; }
    setLogoPath(res.path!);
    const supabase = createClient();
    const { data } = await supabase.storage.from("business-logos").createSignedUrl(res.path!, 3600);
    if (data) setLogoUrl(data.signedUrl);
    setLogoUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await upsertBusinessProfile({
      business_name: businessName || null,
      owner_name: ownerName || null,
      license_number: licenseNumber || null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      logo_path: logoPath || null,
      default_payment_terms: defaultPaymentTerms,
    });
    setSaving(false);
    if (res.error) {
      showToast(res.error, false);
    } else {
      showToast("Saved", true);
      setEditing(false);
    }
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Business Profile</p>
          <p className="text-gray-500 text-sm mt-0.5">Appears on all quote and invoice PDFs.</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-orange-400 font-semibold text-sm border border-orange-500/30 bg-orange-500/10 px-4 py-2 rounded-xl active:scale-95 transition-transform"
          >
            Edit
          </button>
        )}
      </div>

      {/* Logo */}
      <div className="flex items-center gap-4">
        <div
          className={`w-16 h-16 rounded-xl bg-[#242424] border border-[#333] flex items-center justify-center overflow-hidden shrink-0 ${editing ? "cursor-pointer active:opacity-70" : ""}`}
          onClick={() => editing && logoInputRef.current?.click()}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          )}
        </div>
        <div>
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="text-orange-400 font-semibold text-sm active:opacity-70 disabled:opacity-50"
              >
                {logoUploading ? "Uploading…" : logoUrl ? "Change Logo" : "Upload Logo"}
              </button>
              <p className="text-gray-600 text-xs mt-0.5">PNG or JPG, appears in PDF header</p>
            </>
          ) : (
            <p className="text-gray-500 text-sm">{logoUrl ? "Logo uploaded" : "No logo"}</p>
          )}
        </div>
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
      </div>

      <input
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        placeholder="Business Name"
        disabled={!editing}
        className={inputCls}
      />

      <div>
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Default Payment Terms</p>
        <div className="grid grid-cols-2 gap-2">
          {(["due_on_receipt", "net_15", "net_30", "net_45"] as PaymentTerms[]).map((t) => (
            <button
              key={t}
              type="button"
              disabled={!editing}
              onClick={() => setDefaultPaymentTerms(t)}
              className={`py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 disabled:pointer-events-none ${
                defaultPaymentTerms === t
                  ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                  : "bg-[#242424] border-[#333333] text-gray-400"
              }`}
            >
              {PAYMENT_TERM_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner / Contractor Name" disabled={!editing} className={inputCls} />
      <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="License Number (optional)" disabled={!editing} className={inputCls} />
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Business Address" disabled={!editing} className={inputCls} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" type="tel" disabled={!editing} className={inputCls} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Business Email" type="email" disabled={!editing} className={inputCls} />

      {/* Toast */}
      {toast && (
        <p className={`text-sm rounded-xl px-4 py-3 border ${toast.ok ? "text-green-400 bg-green-950 border-green-800" : "text-red-400 bg-red-950 border-red-800"}`}>
          {toast.text}
        </p>
      )}

      {editing && (
        <div className="flex gap-3">
          {hasData && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 py-4 rounded-xl text-sm font-semibold border border-[#333333] text-gray-400 active:scale-95 transition-transform"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
