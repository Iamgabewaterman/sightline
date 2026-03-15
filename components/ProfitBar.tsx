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

  const materialZonePct = (materialBudget / totalQuote) * 100;
  const laborZonePct = (laborBudget / totalQuote) * 100;

  const rawFillPct = (actualMaterialCost / totalQuote) * 100;
  const fillPct = Math.min(rawFillPct, 100);
  const hasData = actualMaterialCost > 0;

  const isOverQuote = actualMaterialCost >= totalQuote;
  const isOverMaterials = actualMaterialCost > materialBudget;

  let status = "No costs logged yet";
  let statusColor = "text-gray-500";
  let fillHex = "#F97316"; // orange = on track

  if (hasData) {
    if (isOverQuote) {
      status = "Over budget";
      statusColor = "text-red-400";
      fillHex = "#ef4444";
    } else if (isOverMaterials) {
      status = "Eating into margin";
      statusColor = "text-yellow-400";
      fillHex = "#eab308";
    } else {
      status = "On track";
      statusColor = "text-orange-500";
      fillHex = "#F97316";
    }
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
          Profitability
        </p>
        <span className={`text-xs font-bold ${statusColor}`}>{status}</span>
      </div>

      {/* Bar */}
      <div className="relative h-7 bg-[#242424] rounded-xl overflow-hidden">
        {/* Profit zone — slightly lighter to show it's the cushion */}
        <div
          className="absolute top-0 bottom-0 bg-[#2a2a2a]"
          style={{ left: `${materialZonePct + laborZonePct}%`, right: 0 }}
        />
        {/* Zone divider lines */}
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-500 z-10"
          style={{ left: `${materialZonePct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-500 z-10"
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

      {/* Zone labels */}
      <div className="relative h-5 mt-1">
        <span
          className="absolute text-gray-500 text-xs"
          style={{ left: `${materialZonePct / 2}%`, transform: "translateX(-50%)" }}
        >
          Mat.
        </span>
        <span
          className="absolute text-gray-500 text-xs"
          style={{
            left: `${materialZonePct + laborZonePct / 2}%`,
            transform: "translateX(-50%)",
          }}
        >
          Labor
        </span>
        <span
          className="absolute text-gray-500 text-xs"
          style={{
            left: `${materialZonePct + laborZonePct + (100 - materialZonePct - laborZonePct) / 2}%`,
            transform: "translateX(-50%)",
          }}
        >
          Profit
        </span>
      </div>

      {/* Stats */}
      <div className="mt-3 flex flex-col gap-2 border-t border-[#2a2a2a] pt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Materials logged</span>
          <span>
            <span
              className={`font-semibold ${
                isOverQuote ? "text-red-400" : isOverMaterials ? "text-yellow-400" : "text-orange-500"
              }`}
            >
              ${Math.round(actualMaterialCost).toLocaleString()}
            </span>
            <span className="text-gray-500"> / ${Math.round(materialBudget).toLocaleString()} est.</span>
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Labor est.</span>
          <span className="text-gray-400">${Math.round(laborBudget).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Profit zone</span>
          <span className="text-gray-400">${Math.round(profitBudget).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-[#2a2a2a] pt-2">
          <span className="text-gray-400">Total quote</span>
          <span className="text-white font-semibold">${Math.round(totalQuote).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
