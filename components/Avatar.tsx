"use client";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

const COLORS = [
  "#F97316", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#F59E0B", "#06B6D4",
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (name.charCodeAt(i) + hash * 31) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Avatar({ name, avatarUrl, size = 36, className = "" }: AvatarProps) {
  const style: React.CSSProperties = { width: size, height: size };

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center shrink-0 font-bold text-white select-none ${className}`}
      style={{ ...style, backgroundColor: getColor(name || "?"), fontSize: Math.round(size * 0.38) }}
    >
      {getInitials(name || "?")}
    </div>
  );
}
