const TYPE_LABELS: Record<string, string> = {
  drywall: "Drywall",
  framing: "Framing",
  plumbing: "Plumbing",
  paint: "Paint",
  trim: "Trim",
  roofing: "Roofing",
  tile: "Tile",
  flooring: "Flooring",
  electrical: "Electrical",
  hvac: "HVAC",
  concrete: "Concrete",
  landscaping: "Landscaping",
};

export default function TypeTags({ types }: { types: string[] }) {
  if (!types?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {types.map((t) => (
        <span
          key={t}
          className="text-xs font-semibold uppercase tracking-wider text-zinc-400 bg-zinc-800 px-3 py-1 rounded-full"
        >
          {TYPE_LABELS[t] ?? t}
        </span>
      ))}
    </div>
  );
}
