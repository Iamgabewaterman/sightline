export default function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto animate-pulse">
        <div className="h-9 w-48 bg-[#1A1A1A] rounded-xl mb-6" />
        <div className="h-5 w-72 bg-[#1A1A1A] rounded-lg mb-8" />
        <div className="flex flex-col gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5">
              <div className="h-5 w-36 bg-[#242424] rounded mb-2" />
              <div className="h-4 w-full bg-[#242424] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
