export default function ReceiptsLoading() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto animate-pulse">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-[#1A1A1A] rounded-xl" />
          <div className="h-9 w-36 bg-[#1A1A1A] rounded-xl" />
        </div>

        {/* Total card */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 mb-6">
          <div className="h-3 w-40 bg-[#242424] rounded mb-3" />
          <div className="h-14 w-32 bg-[#242424] rounded mb-2" />
          <div className="h-4 w-48 bg-[#242424] rounded" />
        </div>

        {/* Sort buttons */}
        <div className="flex gap-2 mb-5">
          <div className="h-11 w-24 bg-[#1A1A1A] rounded-xl" />
          <div className="h-11 w-24 bg-[#1A1A1A] rounded-xl" />
        </div>

        {/* Receipt rows */}
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex items-center gap-4">
              <div className="shrink-0 w-10 h-10 bg-[#242424] rounded-lg" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-[#242424] rounded mb-2" />
                <div className="h-3 w-44 bg-[#242424] rounded" />
              </div>
              <div className="h-5 w-16 bg-[#242424] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
