"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/app/actions/auth";

export default function SignupForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirm = formData.get("confirm") as string;

    if (password !== confirm) {
      setError("Passwords don't match.");
      setLoading(false);
      return;
    }

    const result = await signUp(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 text-center">
        <div className="w-full max-w-sm">
          <div className="text-5xl mb-6">✓</div>
          <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-zinc-400 mb-8">
            We sent a confirmation link to your email. Click it to activate your account.
          </p>
          <Link
            href="/login"
            className="block bg-white text-black font-bold text-xl py-5 rounded-xl active:scale-95 transition-transform"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-tight">Sightline</h1>
          <p className="text-zinc-500 mt-2">Create your account</p>
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
            autoComplete="new-password"
            placeholder="Password"
            minLength={6}
            className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-4 py-4 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
          />
          <input
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Confirm password"
            minLength={6}
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
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-zinc-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-white font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
