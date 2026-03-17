import Image from "next/image";

export default function BrandLogo() {
  return (
    <div className="flex flex-col items-center gap-3 mb-6">
      {/* Icon */}
      <Image
        src="/new-logo.png.png"
        alt="Sightline"
        width={240}
        height={131}
        priority
        className="w-56 h-auto"
      />

      {/* Wordmark */}
      <span
        className="text-white font-black text-4xl leading-none"
        style={{ letterSpacing: "0.15em" }}
      >
        SIGHTLINE
      </span>

      {/* Tagline */}
      <span className="text-[#F97316] text-sm font-medium tracking-wide">
        Every job. One view.
      </span>
    </div>
  );
}
