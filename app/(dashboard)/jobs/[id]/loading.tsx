export default function JobDetailLoading() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto animate-pulse">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#1A1A1A] rounded-xl" />
            <div className="h-9 w-48 bg-[#1A1A1A] rounded-xl" />
          </div>
          <div className="h-10 w-16 bg-[#1A1A1A] rounded-xl" />
        </div>

        {/* Status toggle */}
        <div className="h-12 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl mb-4" />

        {/* Quote button */}
        <div className="h-14 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl mb-4" />

        {/* Detail cards */}
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
              <div className="h-3 w-20 bg-[#242424] rounded mb-2" />
              <div className="h-5 w-full bg-[#242424] rounded" />
            </div>
          ))}
        </div>

        {/* Dimensions */}
        <div className="mt-8">
          <div className="h-6 w-32 bg-[#1A1A1A] rounded mb-4" />
          <div className="h-24 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl" />
        </div>

        {/* Materials */}
        <div className="mt-8">
          <div className="flex justify-between mb-4">
            <div className="h-6 w-24 bg-[#1A1A1A] rounded" />
            <div className="h-10 w-20 bg-[#1A1A1A] rounded-xl" />
          </div>
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl h-24" />
            ))}
          </div>
        </div>

        {/* Labor */}
        <div className="mt-8">
          <div className="h-6 w-16 bg-[#1A1A1A] rounded mb-4" />
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl h-20" />
        </div>

        {/* Receipts */}
        <div className="mt-8">
          <div className="h-6 w-24 bg-[#1A1A1A] rounded mb-4" />
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl h-14" />
        </div>

        {/* Photos */}
        <div className="mt-8">
          <div className="h-6 w-20 bg-[#1A1A1A] rounded mb-4" />
          <div className="flex gap-2 mb-5 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-24 bg-[#1A1A1A] rounded-xl shrink-0" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-square bg-[#1A1A1A] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
