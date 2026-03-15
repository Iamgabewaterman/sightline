export default function CalculatorLoading() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto animate-pulse">
        {/* Header */}
        <div className="mb-6">
          <div className="h-9 w-36 bg-[#1A1A1A] rounded-xl mb-2" />
          <div className="h-4 w-52 bg-[#1A1A1A] rounded" />
        </div>

        {/* Trade selector pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-11 w-24 bg-[#1A1A1A] rounded-xl" />
          ))}
        </div>

        {/* Input fields */}
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="h-3 w-24 bg-[#1A1A1A] rounded mb-2" />
              <div className="h-14 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl" />
            </div>
          ))}
        </div>

        {/* Calculate button */}
        <div className="h-16 bg-[#1A1A1A] rounded-xl mt-6" />
      </div>
    </div>
  );
}
