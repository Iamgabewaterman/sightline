import { Job } from "@/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function TimelineSection({
  job,
  timelineInsight,
}: {
  job: Job;
  timelineInsight: { min: number; max: number; type: string } | null;
}) {
  if (!job.start_date) return null;

  const now = new Date();
  const startMs = new Date(job.start_date).getTime();
  const accumulatedPausedDays = Number(job.total_paused_days ?? 0);

  // Working days elapsed up to right now (excludes all paused time)
  let workingDaysElapsed: number | null = null;
  if (job.status === "active") {
    const calendarDays = (now.getTime() - startMs) / 86400000;
    workingDaysElapsed = Math.max(1, Math.round(calendarDays - accumulatedPausedDays));
  }

  // Working days elapsed up to when the pause started (for on_hold display)
  let workingDaysSoFar: number | null = null;
  if (job.status === "on_hold" && job.paused_at) {
    const calendarDays = (new Date(job.paused_at).getTime() - startMs) / 86400000;
    workingDaysSoFar = Math.max(0, Math.round(calendarDays - accumulatedPausedDays));
  }

  const totalDays = job.total_days;

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Timeline</p>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Started</span>
          <span className="text-white font-semibold text-sm">{fmtDate(job.start_date)}</span>
        </div>

        {job.status === "active" && workingDaysElapsed !== null && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Working days</span>
            <span className="text-orange-400 font-bold text-sm">
              {workingDaysElapsed} day{workingDaysElapsed !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {job.status === "on_hold" && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Status</span>
              <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2.5 py-1 rounded-full">
                On Hold
              </span>
            </div>
            {workingDaysSoFar !== null && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Working days so far</span>
                <span className="text-gray-300 font-semibold text-sm">
                  {workingDaysSoFar} day{workingDaysSoFar !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </>
        )}

        {job.status === "completed" && job.completed_date && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Completed</span>
            <span className="text-white font-semibold text-sm">{fmtDate(job.completed_date)}</span>
          </div>
        )}

        {job.status === "completed" && totalDays !== null && (
          <div className="flex justify-between items-center pt-1 border-t border-[#2a2a2a]">
            <span className="text-gray-400 text-sm">Total working days</span>
            <span className="text-green-400 font-bold text-sm">
              {totalDays} day{totalDays !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {timelineInsight && (
        <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
          <div className="flex items-start gap-2">
            <span className="text-orange-400 text-xs mt-0.5">✦</span>
            <p className="text-gray-400 text-xs leading-relaxed">
              Based on your past{" "}
              <span className="text-white capitalize">{timelineInsight.type}</span> jobs, this typically takes{" "}
              <span className="text-orange-400 font-semibold">
                {timelineInsight.min === timelineInsight.max
                  ? `${timelineInsight.min} days`
                  : `${timelineInsight.min}–${timelineInsight.max} days`}
              </span>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
