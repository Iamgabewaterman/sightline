interface Props {
  materialBudget: number;
  laborBudget: number;
  totalQuote: number;
  actualMaterialCost: number;
}

export default function ProfitBar({
  materialBudget,
  laborBudget,
  totalQuote,
  actualMaterialCost,
}: Props) {
  if (totalQuote <= 0) return null;

  const profitBudget = totalQuote - materialBudget - laborBudget;

  // Zone widths as % of total quote
  const materialZonePct = (materialBudget / totalQuote) * 100;
  const laborZonePct = (laborBudget / totalQuote) * 100;

  // Actual fill — capped at 100% visually
  const rawFillPct = (actualMaterialCost / totalQuote) * 100;
  const fillPct = Math.min(rawFillPct, 100);
  const hasData = actualMaterialCost > 0;

  // Status + fill color
  const isOverQuote = actualMaterialCost >= totalQuote;
  const isOverMaterials = actualMaterialCost > materialBudget;

  let status = "No costs logged yet";
  let statusColor = "text-zinc-600";
  let fillHex = "#ffffff"; // white = on track

  if (hasData) {
    if (isOverQuote) {
      status = "Over budget";
      statusColor = "text-red-400";
      fillHex = "#ef4444";
    } else if (isOverMaterials) {
      status = "Eating into margin";
      statusColor = "text-yellow-400";
      fillHex = "#facc15";
    } else {
      status = "On track";
      statusColor = "text-emerald-400";
      fillHex = "#ffffff";
    }
  }

  const actualFormatted = `$${Math.round(actualMaterialCost).toLocaleString()}`;
  const materialBudgetFormatted = `$${Math.round(materialBudget).toLocaleString()}`;
  const laborBudgetFormatted = `$${Math.round(laborBudget).toLocaleString()}`;
  const profitFormatted = `$${Math.round(profitBudget).toLocaleString()}`;
  const quoteFormatted = `$${Math.round(totalQuote).toLocaleString()}`;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">
          Profitability
        </p>
        <span className={`text-xs font-bold ${statusColor}`}>{status}</span>
      </div>

      {/* Bar */}
      <div className="relative h-7 bg-zinc-800 rounded-xl overflow-hidden">
        {/* Profit zone — slightly lighter to show it's the cushion */}
        <div
          className="absolute top-0 bottom-0 bg-zinc-700"
          style={{ left: `${materialZonePct + laborZonePct}%`, right: 0 }}
        />

        {/* Zone divider lines */}
        <div
          className="absolute top-0 bottom-0 w-px bg-zinc-600 z-10"
          style={{ left: `${materialZonePct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-zinc-600 z-10"
          style={{ left: `${materialZonePct + laborZonePct}%` }}
        />

        {/* Actual spend fill */}
        {hasData && (
          <div
            className="absolute top-0 left-0 bottom-0 transition-all duration-700"
            style={{ width: `${fillPct}%`, backgroundColor: fillHex }}
          />
        )}
      </div>

      {/* Zone labels under bar */}
      <div className="relative h-5 mt-1">
        <span
          className="absolute text-zinc-600 text-xs"
          style={{ left: `${materialZonePct / 2}%`, transform: "translateX(-50%)" }}
        >
          Mat.
        </span>
        <span
          className="absolute text-zinc-600 text-xs"
          style={{
            left: `${materialZonePct + laborZonePct / 2}%`,
            transform: "translateX(-50%)",
          }}
        >
          Labor
        </span>
        <span
          className="absolute text-zinc-600 text-xs"
          style={{
            left: `${materialZonePct + laborZonePct + (100 - materialZonePct - laborZonePct) / 2}%`,
            transform: "translateX(-50%)",
          }}
        >
          Profit
        </span>
      </div>

      {/* Stats */}
      <div className="mt-3 flex flex-col gap-2 border-t border-zinc-800 pt-3">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Materials logged</span>
          <span>
            <span
              className={`font-semibold ${
                isOverQuote
                  ? "text-red-400"
                  : isOverMaterials
                  ? "text-yellow-400"
                  : "text-white"
              }`}
            >
              {actualFormatted}
            </span>
            <span className="text-zinc-600"> / {materialBudgetFormatted} est.</span>
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Labor est.</span>
          <span className="text-zinc-400">{laborBudgetFormatted}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Profit zone</span>
          <span className="text-zinc-400">{profitFormatted}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-zinc-800 pt-2 mt-0.5">
          <span className="text-zinc-500">Total quote</span>
          <span className="text-white font-semibold">{quoteFormatted}</span>
        </div>
      </div>
    </div>
  );
}
