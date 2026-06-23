"use client";

import { useState } from "react";
import { approveChangeOrderPortal, declineChangeOrderPortal } from "@/app/actions/change-orders";

export default function PortalChangeOrderActions({
  changeOrderId,
  jobId,
  accessToken,
}: {
  changeOrderId: string;
  jobId: string;
  accessToken: string;
}) {
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [done, setDone] = useState<"approved" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "approve" | "decline") {
    setBusy(kind);
    setError(null);
    const res =
      kind === "approve"
        ? await approveChangeOrderPortal(changeOrderId, jobId, accessToken)
        : await declineChangeOrderPortal(changeOrderId, jobId, accessToken);
    setBusy(null);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setDone(kind === "approve" ? "approved" : "declined");
  }

  if (done) {
    return (
      <div
        className={`rounded-xl px-4 py-3 text-center font-semibold ${
          done === "approved"
            ? "bg-green-600/15 border border-green-500/40 text-green-400"
            : "bg-[#242424] border border-[#2a2a2a] text-gray-300"
        }`}
      >
        {done === "approved" ? "✓ Approved — thank you!" : "Change declined."}
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => run("approve")}
          disabled={busy !== null}
          className="flex-1 bg-green-600 text-white font-bold text-base py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => run("decline")}
          disabled={busy !== null}
          className="flex-1 bg-[#242424] border border-[#2a2a2a] text-gray-300 font-bold text-base py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          {busy === "decline" ? "…" : "Decline"}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
    </div>
  );
}
