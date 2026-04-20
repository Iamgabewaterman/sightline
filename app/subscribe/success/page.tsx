import Link from "next/link";

export default function SubscribeSuccessPage() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold text-white mb-3">You're in.</h1>
        <p className="text-gray-400 mb-8">
          Sightline Pro is active. Every job, one view.
        </p>
        <Link
          href="/jobs"
          className="block bg-orange-500 text-white font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
