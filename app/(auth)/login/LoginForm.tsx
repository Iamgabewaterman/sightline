"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "@/app/actions/auth";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn(new FormData(e.currentTarget));
    // signIn redirects on success — only runs on error
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-tight">Sightline</h1>
          <p className="text-zinc-500 mt-2">Every job. One view.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-4 py-4 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
          />
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-4 py-4 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
          />

          {error && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black font-bold text-xl py-5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mt-2"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-zinc-500 mt-6">
          No account?{" "}
          <Link href="/signup" className="text-white font-semibold">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
