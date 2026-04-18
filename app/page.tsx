import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Briefcase, Zap, Camera, FileText, Globe, ScanLine,
  Navigation, BarChart2, Users, Calculator, WifiOff, Bell,
  Edit3, CloudRain, FolderOpen, X, Check,
} from "lucide-react";
import StandaloneRedirect from "@/components/StandaloneRedirect";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Sightline — Job Management for Contractors",
  description:
    "Replace QuickBooks, Buildertrend, and your notebook. One app for every job. $49.99/month. Built by a carpenter.",
};

// ── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Briefcase,  label: "Jobs & Timelines",        desc: "Track every job from start to finish" },
  { icon: Zap,        label: "AI Material Estimates",   desc: "Accurate cost estimates in seconds" },
  { icon: Camera,     label: "Photo Documentation",     desc: "Before, during, and after — all organized" },
  { icon: FileText,   label: "Quotes & Invoices",       desc: "Professional PDFs, ready to send" },
  { icon: Globe,      label: "Client Portal",           desc: "Clients track job progress in real time" },
  { icon: ScanLine,   label: "Receipt Scanning",        desc: "OCR extracts amounts automatically" },
  { icon: Navigation, label: "GPS Mileage Tracking",    desc: "Auto-log drives for tax deductions" },
  { icon: BarChart2,  label: "Tax Reports",             desc: "Export-ready summaries for your accountant" },
  { icon: Users,      label: "Team Management",         desc: "Assign crew, track hours, share job details" },
  { icon: Calculator, label: "Trade Calculators",       desc: "Material math for any trade built in" },
  { icon: WifiOff,    label: "Offline Mode",            desc: "Keep working without signal" },
  { icon: Bell,       label: "Push Notifications",      desc: "Invoice paid, crew clocked in, and more" },
  { icon: Edit3,      label: "E-Signatures",            desc: "Get quotes signed from anywhere" },
  { icon: CloudRain,  label: "Weather Alerts",          desc: "Know before your crew shows up" },
  { icon: FolderOpen, label: "Document Storage",        desc: "Permits, plans, contracts — all in one place" },
];

const PROBLEMS = [
  "QuickBooks doesn't know what a square foot is",
  "Buildertrend starts at $299/month — and tells small contractors they don't qualify",
  "Your estimate is in a notebook, your invoice is in email, your receipts are in your truck",
  "You're running a business off group texts and gut feelings",
];

const TESTIMONIALS = [
  {
    quote: "I used to spend Sunday nights catching up on paperwork. Now I'm done by Friday. Everything's in one place.",
    name: "Mike R.",
    trade: "General Contractor",
    city: "Portland, OR",
  },
  {
    quote: "The material estimator alone saved me from underbidding a $40k job. I won't quote without it now.",
    name: "Sarah K.",
    trade: "Remodeling Contractor",
    city: "Eugene, OR",
  },
  {
    quote: "My guys clock in on their phones and I see it in real time. No more 'I forgot how many hours' conversations.",
    name: "David T.",
    trade: "Framing Contractor",
    city: "Bend, OR",
  },
];

const INCLUDED = [
  "Jobs, photos & timeline tracking",
  "AI material estimates",
  "Quotes & invoices (PDF + e-sign)",
  "GPS mileage & tax reports",
  "Client portal + receipt scanning",
  "Team management & time tracking",
  "Push notifications & offline mode",
  "Trade calculators for any job",
];

// ── Logo mark ─────────────────────────────────────────────────────────────────

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} style={{ borderRadius: "18%" }}>
      <rect width="512" height="512" fill="#0F0F0F" />
      <polygon points="106,418 406,418 256,118" fill="none" stroke="white" strokeWidth="44" strokeLinejoin="miter" />
      <rect x="106" y="48" width="300" height="70" rx="10" fill="#0F0F0F" stroke="white" strokeWidth="12" />
      <path d="M 160 108 Q 256 62 352 108" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="256" cy="83" rx="28" ry="15" fill="#F97316" />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white">
      {/* Redirect PWA (standalone) users straight to the dashboard */}
      <StandaloneRedirect to="/jobs" />

      {/* ── Sticky nav ── */}
      <header className="sticky top-0 z-50 bg-[#0F0F0F]/90 backdrop-blur-md border-b border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <LogoMark size={32} />
            <span className="text-white font-black text-xl tracking-tight">Sightline</span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#problem" className="hover:text-white transition-colors">Why Sightline</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
          </nav>

          {/* CTA buttons */}
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Link
                href="/jobs"
                className="bg-orange-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-orange-400 transition-colors active:scale-95"
              >
                Go to App →
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-300 font-semibold text-sm px-4 py-2 rounded-xl hover:text-white transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="bg-orange-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-orange-400 transition-colors active:scale-95"
                >
                  Start Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="min-h-[92vh] flex flex-col items-center justify-center text-center px-5 pt-16 pb-20">
        {/* Beta badge */}
        <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-1.5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">
            Beta — 3 months free
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] mb-6 max-w-3xl">
          Every job.{" "}
          <span className="text-orange-500">One view.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-gray-400 text-lg sm:text-xl max-w-xl leading-relaxed mb-10">
          The job management app built by a working carpenter. Replaces QuickBooks, Buildertrend,
          and your notebook — for{" "}
          <span className="text-white font-semibold">$49.99/month.</span>
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs sm:max-w-none">
          <Link
            href="/signup"
            className="w-full sm:w-auto bg-orange-500 text-white font-bold text-lg px-8 py-4 rounded-2xl hover:bg-orange-400 transition-colors active:scale-95 text-center"
          >
            Start Free Beta
          </Link>
          <a
            href="#problem"
            className="w-full sm:w-auto border border-[#2a2a2a] text-gray-300 font-semibold text-lg px-8 py-4 rounded-2xl hover:border-[#444] hover:text-white transition-colors text-center"
          >
            See How It Works
          </a>
        </div>

        {/* Social proof micro */}
        <p className="mt-10 text-gray-600 text-sm">
          No credit card required · Cancel anytime · Field members always free
        </p>
      </section>

      {/* ── Problem section ── */}
      <section id="problem" className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-4">
            QuickBooks doesn&rsquo;t know what happens at the jobsite.
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
            The tools that exist were built for accountants and enterprise contractors — not for you.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PROBLEMS.map((problem, i) => (
              <div
                key={i}
                className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-6 py-5 flex items-start gap-4"
              >
                <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <X size={16} className="text-red-400" />
                </div>
                <p className="text-gray-300 text-base leading-snug">{problem}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution / Features ── */}
      <section id="features" className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-4">
            Sightline does all of it
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
            Every feature a working contractor actually needs — nothing you don&rsquo;t.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-4 py-5 flex flex-col gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">{label}</p>
                  <p className="text-gray-500 text-xs mt-1 leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof ── */}
      <section className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-4">
            Built for contractors like you
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-md mx-auto">
            From solo operators to crews of ten — Sightline fits the way you work.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TESTIMONIALS.map(({ quote, name, trade, city }) => (
              <div
                key={name}
                className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-6 py-6 flex flex-col"
              >
                <div className="text-orange-500 text-4xl font-black leading-none mb-4">&ldquo;</div>
                <p className="text-gray-300 text-base leading-relaxed flex-1">{quote}</p>
                <div className="mt-5 pt-4 border-t border-[#2a2a2a]">
                  <p className="text-white font-bold text-sm">{name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {trade} · {city}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-lg mx-auto">

          {/* Beta banner */}
          <div className="bg-orange-500 rounded-t-2xl px-6 py-3 text-center">
            <p className="text-white font-bold text-sm tracking-wide">
              🎉 Beta offer — 3 months free, no credit card required
            </p>
          </div>

          {/* Pricing card */}
          <div className="bg-[#1A1A1A] border border-orange-500/30 border-t-0 rounded-b-2xl px-8 py-8">
            {/* Price */}
            <div className="text-center mb-6">
              <div className="flex items-start justify-center gap-1">
                <span className="text-gray-400 text-xl font-semibold mt-3">$</span>
                <span className="text-white font-black text-7xl leading-none">49</span>
                <span className="text-white font-black text-4xl leading-none mt-4">.99</span>
                <span className="text-gray-400 text-xl font-semibold mt-auto mb-1">/mo</span>
              </div>
              <p className="text-gray-400 text-base mt-3 font-medium">
                Everything you need. Nothing you don&rsquo;t.
              </p>
            </div>

            {/* Feature list */}
            <ul className="flex flex-col gap-3 mb-6">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-orange-500" strokeWidth={3} />
                  </div>
                  <span className="text-gray-300 text-sm">{item}</span>
                </li>
              ))}
            </ul>

            {/* Field member callout */}
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 text-center mb-6">
              <p className="text-orange-400 font-semibold text-sm">
                Field members always free — they never pay
              </p>
            </div>

            {/* CTA */}
            <Link
              href="/signup"
              className="block w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-2xl text-center hover:bg-orange-400 transition-colors active:scale-95"
            >
              Start Free Beta
            </Link>
            <p className="text-gray-600 text-xs text-center mt-3">
              No credit card · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ── Built by a carpenter ── */}
      <section id="about" className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
            Built from the jobsite up
          </h2>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-7 py-7 text-left">
            <p className="text-gray-300 text-base leading-relaxed">
              Sightline was built by{" "}
              <span className="text-white font-semibold">Gabriel Waterman</span>, a 20-year-old
              carpenter from Tigard, Oregon working in residential construction. Tired of wasting time
              and money juggling separate apps that don&rsquo;t talk to each other, he built the tool
              he always wished existed.
            </p>
            <p className="text-gray-400 text-base leading-relaxed mt-4">
              Every feature in Sightline solves a real problem from a real job site. Not from a product
              meeting. Not from a focus group. From actually swinging a hammer and running jobs.
            </p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 px-5 border-t border-[#1a1a1a] text-center">
        <div className="max-w-lg mx-auto">
          <LogoMark size={56} />
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-6 mb-3">
            Ready to run your business like a business?
          </h2>
          <p className="text-gray-500 mb-8">
            Start free. No credit card. Cancel anytime.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-orange-500 text-white font-bold text-lg px-10 py-5 rounded-2xl hover:bg-orange-400 transition-colors active:scale-95"
          >
            Start Free Beta
          </Link>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-3">
            Get in touch
          </h2>
          <p className="text-gray-500 text-center mb-10 max-w-md mx-auto">
            Questions about pricing, features, or getting started? We&rsquo;ll reply same day.
          </p>
          <ContactForm variant="landing" />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1a1a1a] py-12 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start gap-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-white font-black text-lg">Sightline</span>
            </div>
            <p className="text-gray-600 text-xs">Every job. One view.</p>
            <p className="text-gray-700 text-xs mt-1">Made in Oregon 🌲</p>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-5 flex-wrap justify-center">
            <Link href="/login" className="text-gray-500 text-sm hover:text-white transition-colors">
              Log In
            </Link>
            <Link href="/signup" className="text-gray-500 text-sm hover:text-white transition-colors">
              Sign Up
            </Link>
            <Link href="/privacy" className="text-gray-500 text-sm hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-gray-500 text-sm hover:text-white transition-colors">
              Terms
            </Link>
          </nav>
        </div>
      </footer>

    </div>
  );
}
