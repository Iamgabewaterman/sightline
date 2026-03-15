export default function AllJobsLoading() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto animate-pulse">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#1A1A1A] rounded-xl" />
          <div className="h-9 w-28 bg-[#1A1A1A] rounded-xl" />
        </div>

        {/* Job cards */}
        <ul className="flex flex-col gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5">
              <div className="h-6 w-48 bg-[#242424] rounded-lg mb-3" />
              <div className="flex gap-2 mb-3">
                <div className="h-6 w-20 bg-[#242424] rounded-full" />
                <div className="h-6 w-16 bg-[#242424] rounded-full" />
              </div>
              <div className="h-4 w-36 bg-[#242424] rounded mb-1" />
              <div className="h-3 w-20 bg-[#242424] rounded" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
