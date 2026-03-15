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
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 text-center">
        <div className="w-full max-w-sm">
          <div className="text-5xl mb-6 text-orange-500">✓</div>
          <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-gray-400 mb-8">
            We sent a confirmation link to your email. Click it to activate your account.
          </p>
          <Link
            href="/login"
            className="block bg-orange-500 text-white font-bold text-xl py-5 rounded-xl active:scale-95 transition-transform"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            <h1 className="text-4xl font-black text-white tracking-tight">Sightline</h1>
          </div>
          <p className="text-gray-400 mt-1">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            className="bg-gray-800 border border-gray-700 text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Password"
            minLength={6}
            className="bg-gray-800 border border-gray-700 text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <input
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Confirm password"
            minLength={6}
            className="bg-gray-800 border border-gray-700 text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
          />

          {error && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-orange-500 text-white font-bold text-xl py-5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mt-2"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-gray-400 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-orange-500 font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
