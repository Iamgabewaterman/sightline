"use client";

import { useState } from "react";
import { ProfileWithCompany } from "@/app/actions/team";
import { FieldMember } from "@/types";
import {
  updateMemberPermissions,
  removeMember,
  regenerateInviteCode,
} from "@/app/actions/team";

interface Props {
  profile: ProfileWithCompany;
  members: FieldMember[];
}

export default function TeamSection({ profile, members: initialMembers }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [inviteCode, setInviteCode] = useState(profile.company?.invite_code ?? "");
  const [copied, setCopied] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({
        title: "Join my Sightline team",
        text: `Use invite code ${inviteCode} to join my team on Sightline.`,
      });
    } else {
      handleCopy();
    }
  }

  async function handleRegen() {
    setRegenLoading(true);
    const result = await regenerateInviteCode();
    if (result.code) setInviteCode(result.code);
    setRegenLoading(false);
  }

  async function handleToggle(
    memberId: string,
    field: "can_see_financials" | "can_see_all_jobs" | "can_see_client_info",
    current: boolean
  ) {
    setSaving(memberId + field);
    const result = await updateMemberPermissions(memberId, { [field]: !current });
    if (!result.error) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, [field]: !current } : m))
      );
    }
    setSaving(null);
  }

  async function handleRemove(memberId: string) {
    setSaving(memberId + "remove");
    const result = await removeMember(memberId);
    if (!result.error) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
    setRemoveConfirm(null);
    setSaving(null);
  }

  if (profile.role !== "owner") {
    return (
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex flex-col gap-3">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Your Team</p>
        <p className="text-white font-semibold">
          {profile.company ? `Member of a team` : "No team linked"}
        </p>
        <p className="text-gray-500 text-sm">Contact your employer to manage team settings.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex flex-col gap-4">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Team</p>

        {/* Invite Code */}
        <div>
          <p className="text-gray-500 text-sm mb-2">Your invite code — share with field members</p>
          <div className="flex items-center gap-3 bg-[#242424] border border-[#333] rounded-xl px-4 py-4">
            <span className="flex-1 text-white font-mono text-2xl font-bold tracking-[0.25em]">
              {inviteCode}
            </span>
            <button
              onClick={handleCopy}
              className="shrink-0 px-4 py-2 rounded-lg bg-[#1A1A1A] border border-[#2a2a2a] text-sm font-semibold active:scale-95 transition-transform"
              style={{ color: copied ? "#22c55e" : "#F97316" }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleShare}
              className="shrink-0 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold active:scale-95 transition-transform"
            >
              Share
            </button>
          </div>
          <button
            onClick={handleRegen}
            disabled={regenLoading}
            className="mt-2 text-gray-500 text-xs underline active:opacity-70"
          >
            {regenLoading ? "Regenerating..." : "Generate new code"}
          </button>
          <p className="text-gray-600 text-xs mt-1">
            Generating a new code invalidates the old one. Existing members are not affected.
          </p>
        </div>

        {/* Field Members List */}
        <div>
          <p className="text-gray-500 text-sm mb-2">
            {members.length === 0 ? "No field members yet" : `${members.length} field member${members.length !== 1 ? "s" : ""}`}
          </p>

          {members.map((member) => (
            <div key={member.id} className="bg-[#242424] border border-[#333] rounded-xl px-4 py-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white font-semibold text-base">
                    {member.display_name ?? "Field Member"}
                  </p>
                  <p className="text-gray-500 text-sm">{(member as FieldMember & { email?: string }).email ?? member.id.slice(0, 8)}</p>
                </div>
                <button
                  onClick={() => setRemoveConfirm(member.id)}
                  className="text-red-400 text-sm font-semibold px-3 py-2 rounded-lg bg-red-950/40 border border-red-900/40 active:scale-95 transition-transform"
                >
                  Remove
                </button>
              </div>

              {/* Permission toggles */}
              <div className="flex flex-col gap-2">
                {(
                  [
                    ["can_see_financials", "See financials", "Invoices, margins, profitability"],
                    ["can_see_all_jobs", "See all jobs", "All jobs, not just assigned ones"],
                    ["can_see_client_info", "See client info", "Client names, addresses, contact"],
                  ] as [keyof FieldMember, string, string][]
                ).map(([field, label, sub]) => {
                  const value = member[field] as boolean;
                  const key = member.id + field;
                  return (
                    <button
                      key={field}
                      onClick={() => handleToggle(member.id, field as "can_see_financials" | "can_see_all_jobs" | "can_see_client_info", value)}
                      disabled={saving === key}
                      className="flex items-center justify-between py-2 active:opacity-70 transition-opacity"
                    >
                      <div className="text-left">
                        <p className="text-white text-sm font-semibold">{label}</p>
                        <p className="text-gray-500 text-xs">{sub}</p>
                      </div>
                      {/* Toggle pill */}
                      <div
                        className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${value ? "bg-orange-500" : "bg-[#333]"}`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-0"}`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Remove confirm sheet */}
      {removeConfirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setRemoveConfirm(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 py-6"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            <p className="text-white text-lg font-bold mb-1">Remove field member?</p>
            <p className="text-gray-400 text-sm mb-6">
              They will lose access to your jobs. They can rejoin with the invite code.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleRemove(removeConfirm)}
                disabled={saving === removeConfirm + "remove"}
                className="bg-red-600 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                Remove
              </button>
              <button
                onClick={() => setRemoveConfirm(null)}
                className="bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-lg py-4 rounded-xl active:scale-95 transition-transform"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
