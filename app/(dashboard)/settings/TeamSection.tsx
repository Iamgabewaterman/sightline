"use client";

import { useState } from "react";
import { ProfileWithCompany, CompanyMember } from "@/app/actions/team";
import {
  updateMemberPermissions,
  removeMember,
  regenerateInviteCode,
} from "@/app/actions/team";

interface Props {
  profile: ProfileWithCompany;
  members: CompanyMember[];
}

const PERMS: { field: keyof CompanyMember; label: string; sub: string }[] = [
  { field: "can_see_financials",  label: "See financials",  sub: "Invoices, margins, profitability" },
  { field: "can_see_all_jobs",    label: "See all jobs",    sub: "All jobs, not just assigned ones" },
  { field: "can_see_client_info", label: "See client info", sub: "Client names, addresses, contacts" },
];

export default function TeamSection({ profile, members: initial }: Props) {
  const [members, setMembers]         = useState(initial);
  const [inviteCode, setInviteCode]   = useState(profile.company?.invite_code ?? "");
  const [copied, setCopied]           = useState(false);
  const [regenLoading, setRegen]      = useState(false);
  const [removeId, setRemoveId]       = useState<string | null>(null);
  const [saving, setSaving]           = useState<string | null>(null);

  function handleCopy() {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: "Join my Sightline team", text: `Invite code: ${inviteCode}` });
    } else {
      handleCopy();
    }
  }

  async function handleRegen() {
    setRegen(true);
    const r = await regenerateInviteCode();
    if (r.code) setInviteCode(r.code);
    setRegen(false);
  }

  async function handleToggle(
    memberId: string,
    field: "can_see_financials" | "can_see_all_jobs" | "can_see_client_info",
    cur: boolean
  ) {
    const key = memberId + field;
    setSaving(key);
    const r = await updateMemberPermissions(memberId, { [field]: !cur });
    if (!r.error) {
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, [field]: !cur } : m));
    }
    setSaving(null);
  }

  async function handleRemove(memberId: string) {
    setSaving(memberId);
    await removeMember(memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setRemoveId(null);
    setSaving(null);
  }

  // Field member view — read only
  if (profile.role !== "owner") {
    return (
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex flex-col gap-2">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Your Team</p>
        <p className="text-white font-semibold">Field Member</p>
        <p className="text-gray-500 text-sm">Contact your employer to manage team settings.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex flex-col gap-5">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Team</p>

        {/* Invite code */}
        <div>
          <p className="text-gray-500 text-sm mb-2">Share this code with your field crew</p>
          <div className="flex items-center gap-2 bg-[#242424] border border-[#333] rounded-xl px-4 py-3 mb-2">
            <span className="flex-1 text-white font-mono text-3xl font-bold tracking-[0.3em]">{inviteCode}</span>
            <button
              onClick={handleCopy}
              className="px-3 py-2 rounded-lg bg-[#1A1A1A] border border-[#2a2a2a] text-sm font-semibold active:scale-95 transition-transform"
              style={{ color: copied ? "#22c55e" : "#F97316" }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleShare}
              className="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold active:scale-95 transition-transform"
            >
              Share
            </button>
          </div>
          <button
            onClick={handleRegen}
            disabled={regenLoading}
            className="text-gray-500 text-xs underline"
          >
            {regenLoading ? "Regenerating..." : "Generate new code"}
          </button>
          <p className="text-gray-600 text-xs mt-0.5">New code invalidates old one. Existing members unaffected.</p>
        </div>

        {/* Members list */}
        <div>
          <p className="text-gray-500 text-sm mb-3">
            {members.length === 0 ? "No field members yet" : `${members.length} field member${members.length !== 1 ? "s" : ""}`}
          </p>

          {members.map((m) => (
            <div key={m.id} className="bg-[#242424] border border-[#333] rounded-xl px-4 py-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-semibold">{m.display_name ?? `Member ${m.user_id.slice(0, 6)}`}</p>
                <button
                  onClick={() => setRemoveId(m.id)}
                  className="text-red-400 text-sm font-semibold px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-900/40 active:scale-95"
                >
                  Remove
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {PERMS.map(({ field, label, sub }) => {
                  const val = m[field] as boolean;
                  const key = m.id + field;
                  return (
                    <button
                      key={field}
                      onClick={() => handleToggle(m.id, field as "can_see_financials" | "can_see_all_jobs" | "can_see_client_info", val)}
                      disabled={saving === key}
                      className="flex items-center justify-between py-2.5 active:opacity-70"
                    >
                      <div className="text-left">
                        <p className="text-white text-sm font-semibold">{label}</p>
                        <p className="text-gray-500 text-xs">{sub}</p>
                      </div>
                      <div className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${val ? "bg-orange-500" : "bg-[#444]"}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${val ? "translate-x-6" : "translate-x-0"}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Remove confirm */}
      {removeId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setRemoveId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 py-6"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}>
            <p className="text-white text-lg font-bold mb-1">Remove this field member?</p>
            <p className="text-gray-400 text-sm mb-5">They lose access to your jobs. They can rejoin with the invite code.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => handleRemove(removeId)} disabled={saving === removeId}
                className="bg-red-600 text-white font-bold text-lg py-4 rounded-xl active:scale-95 disabled:opacity-50">
                Remove
              </button>
              <button onClick={() => setRemoveId(null)}
                className="bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-lg py-4 rounded-xl active:scale-95">
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
