export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-9 w-36 bg-[#1A1A1A] rounded-xl" />
          <div className="h-11 w-28 bg-[#1A1A1A] rounded-xl" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl h-[72px]" />
          ))}
        </div>

        {/* Section label */}
        <div className="h-6 w-32 bg-[#1A1A1A] rounded-lg mb-4" />

        {/* Job cards */}
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="h-6 w-40 bg-[#242424] rounded-lg" />
                <div className="h-5 w-16 bg-[#242424] rounded-full" />
              </div>
              <div className="flex gap-2 mb-3">
                <div className="h-6 w-20 bg-[#242424] rounded-full" />
                <div className="h-6 w-16 bg-[#242424] rounded-full" />
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-32 bg-[#242424] rounded" />
                <div className="h-4 w-16 bg-[#242424] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
