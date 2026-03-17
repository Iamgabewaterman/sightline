"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { BusinessProfile } from "@/types";
import { upsertBusinessProfile, uploadBusinessLogo } from "@/app/actions/business-profile";

const inputCls =
  "bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 w-full";

export default function BusinessProfileSection({
  initial,
}: {
  initial: BusinessProfile | null;
}) {
  const [businessName, setBusinessName] = useState(initial?.business_name ?? "");
  const [ownerName, setOwnerName] = useState(initial?.owner_name ?? "");
  const [licenseNumber, setLicenseNumber] = useState(initial?.license_number ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [logoPath, setLogoPath] = useState(initial?.logo_path ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load signed URL for existing logo
  useState(() => {
    if (initial?.logo_path) {
      const supabase = createClient();
      supabase.storage
        .from("business-logos")
        .createSignedUrl(initial.logo_path, 3600)
        .then(({ data }) => { if (data) setLogoUrl(data.signedUrl); });
    }
  });

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const res = await uploadBusinessLogo(file);
    if (res.error) { setMsg({ text: res.error, ok: false }); setLogoUploading(false); return; }
    setLogoPath(res.path!);
    // Preview
    const supabase = createClient();
    const { data } = await supabase.storage.from("business-logos").createSignedUrl(res.path!, 3600);
    if (data) setLogoUrl(data.signedUrl);
    setLogoUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const res = await upsertBusinessProfile({
      business_name: businessName || null,
      owner_name: ownerName || null,
      license_number: licenseNumber || null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      logo_path: logoPath || null,
    });
    setSaving(false);
    setMsg(res.error ? { text: res.error, ok: false } : { text: "Business profile saved.", ok: true });
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex flex-col gap-4">
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Business Profile</p>
      <p className="text-gray-500 text-sm -mt-2">Appears on all quote and invoice PDFs.</p>

      {/* Logo */}
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-xl bg-[#242424] border border-[#333] flex items-center justify-center overflow-hidden shrink-0 cursor-pointer active:opacity-70"
          onClick={() => logoInputRef.current?.click()}
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
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={logoUploading}
            className="text-orange-400 font-semibold text-sm active:opacity-70 disabled:opacity-50"
          >
            {logoUploading ? "Uploading…" : logoUrl ? "Change Logo" : "Upload Logo"}
          </button>
          <p className="text-gray-600 text-xs mt-0.5">PNG or JPG, appears in PDF header</p>
        </div>
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
      </div>

      <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business Name" className={inputCls} />
      <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner / Contractor Name" className={inputCls} />
      <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="License Number (optional)" className={inputCls} />
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Business Address" className={inputCls} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" type="tel" className={inputCls} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Business Email" type="email" className={inputCls} />

      {msg && (
        <p className={`text-sm rounded-xl px-4 py-3 border ${msg.ok ? "text-green-400 bg-green-950 border-green-800" : "text-red-400 bg-red-950 border-red-800"}`}>
          {msg.text}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Business Profile"}
      </button>
    </div>
  );
}
