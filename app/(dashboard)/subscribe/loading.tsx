export default function SubscribeLoading() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto animate-pulse">
        {/* Header */}
        <div className="h-9 w-40 bg-[#1A1A1A] rounded-xl mb-6" />

        {/* Status banner */}
        <div className="h-14 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl mb-6" />

        {/* Pricing card */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-6 py-8 mb-6">
          <div className="h-5 w-32 bg-[#242424] rounded mb-4" />
          <div className="h-14 w-40 bg-[#242424] rounded mb-6" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-5 bg-[#242424] rounded" />
            ))}
          </div>
        </div>

        {/* CTA button */}
        <div className="h-16 bg-[#1A1A1A] rounded-xl" />
      </div>
    </div>
  );
}
