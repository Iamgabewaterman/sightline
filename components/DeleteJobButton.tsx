"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteJob } from "@/app/actions/jobs";

export default function DeleteJobButton({ jobId, jobName }: { jobId: string; jobName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = confirm(
      `Delete "${jobName}"?\n\nThis will permanently remove the job and all its photos, materials, receipts, and labor logs. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    const result = await deleteJob(jobId);
    if (result.error) {
      alert("Error: " + result.error);
      setDeleting(false);
    } else {
      router.push("/jobs");
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="w-full bg-[#1A1A1A] border border-red-900 text-red-400 font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mt-2"
    >
      {deleting ? "Deleting..." : "Delete Job"}
    </button>
  );
}
