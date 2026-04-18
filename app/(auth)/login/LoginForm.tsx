"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "@/components/BrandLogo";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

const BULLETS = [
  {
    headline: "Stop losing money on material runs",
    sub: "Every receipt scanned, every cost tracked automatically.",
  },
  {
    headline: "Every job documented automatically",
    sub: "Photos, materials, and labor all attached to one job.",
  },
  {
    headline: "Estimates that get smarter over time",
    sub: "Your real costs feed every future quote you build.",
  },
];

export default function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn(new FormData(e.currentTarget));
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  const oauthError =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("error") === "oauth";

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex flex-col">
      {/* ── HERO ── */}
      <div className="flex flex-col items-center px-6 pt-12 pb-10">
        <BrandLogo />
        <p className="text-gray-400 text-base text-center mb-8">
          The job management app built for contractors.
        </p>

        {/* Bullet points */}
        <div className="w-full max-w-sm flex flex-col gap-4">
          {BULLETS.map(({ headline, sub }) => (
            <div key={headline} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-orange-500/15 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M1.5 5l2.5 2.5 4.5-4.5"
                    stroke="#F97316"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <p className="text-white font-semibold text-base leading-snug">
                  {headline}
                </p>
                <p className="text-gray-500 text-sm mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FORM ── */}
      <div className="flex-1 bg-[#111111] border-t border-[#1e1e1e] px-6 pt-8 pb-10 flex flex-col items-center">
        <div className="w-full max-w-sm">
          {/* Tabs */}
          <div className="flex bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl p-1 mb-6 gap-1">
            <span className="flex-1 text-center text-white font-bold text-sm py-2.5 rounded-lg bg-orange-500">
              Sign In
            </span>
            <Link
              href="/signup"
              className="flex-1 text-center text-gray-400 font-semibold text-sm py-2.5 rounded-lg active:scale-95 transition-transform"
            >
              Create
            </Link>
            <Link
              href="/signup?join=1"
              className="flex-1 text-center text-gray-400 font-semibold text-sm py-2.5 rounded-lg active:scale-95 transition-transform"
            >
              Join Team
            </Link>
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mb-4"
          >
            <GoogleIcon />
            {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[#242424]" />
            <span className="text-gray-600 text-sm">or</span>
            <div className="flex-1 h-px bg-[#242424]" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
            />

            {(error || oauthError) && (
              <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
                {oauthError && !error
                  ? "Google sign-in failed. Please try again."
                  : error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-orange-500 text-white font-bold text-xl py-5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mt-1"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            $49.99/month · 3-month free trial · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}
