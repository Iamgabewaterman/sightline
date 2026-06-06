import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import nextDynamic from "next/dynamic";
import { X, Check } from "lucide-react";
import StandaloneRedirect from "@/components/StandaloneRedirect";
import { Suspense } from "react";

export const dynamic = "force-static";

const ContactForm = nextDynamic(() => import("@/components/ContactForm"));
const IdeaBox = nextDynamic(() => import("@/components/IdeaBox"));
const RefCapture = nextDynamic(() => import("@/components/RefCapture"));

export const metadata: Metadata = {
  title: "Sightline — Job Management for Contractors",
  description:
    "Replace QuickBooks, Buildertrend, and your notebook. One app for every job. $49.99/month. Built by a carpenter.",
};

// ── Data ─────────────────────────────────────────────────────────────────────

const PROBLEMS = [
  "QuickBooks doesn't know what a square foot is",
  "Buildertrend starts at $299/month — and tells small contractors they don't qualify",
  "Your estimate is in a notebook, your invoice is in email, your receipts are in your truck",
  "You're running a business off group texts and gut feelings",
];

const HOW_IT_WORKS = [
  {
    step: "1",
    icon: "📋",
    title: "Create a job and add your quote",
    desc: "Name the job, enter your quote total, and add your crew. Takes 60 seconds.",
  },
  {
    step: "2",
    icon: "📷",
    title: "Log materials and scan receipts as you work",
    desc: "Snap receipts on-site. AI reads them and logs every cost to the job automatically.",
  },
  {
    step: "3",
    icon: "📊",
    title: "Know your margin in real time",
    desc: "The profit bar shows exactly where you stand — before the job goes sideways.",
  },
];

const FEATURES = [
  {
    icon: "📊",
    title: "Live Job Profitability",
    desc: "Track materials, labor, and subcontractor costs against your quote in real time — on every job.",
  },
  {
    icon: "📷",
    title: "Receipt Scanning",
    desc: "Snap a photo of any receipt. OCR pulls the total and logs it to the job automatically.",
  },
  {
    icon: "📈",
    title: "Regional Material Pricing",
    desc: "Tracks your material costs over time and flags when prices spike above your own historical average.",
  },
  {
    icon: "🔗",
    title: "Client Portal",
    desc: "Share job progress, photos, and invoices with clients — no account or login required on their end.",
  },
  {
    icon: "📍",
    title: "GPS Mileage & IRS Export",
    desc: "Log job-related drives and export IRS-ready mileage reports come tax time.",
  },
  {
    icon: "📄",
    title: "Custom Report Builder",
    desc: "Generate professional PDF job reports with photos, materials, costs, and timelines — in seconds.",
  },
  {
    icon: "💳",
    title: "ACH & Card Payments",
    desc: "Accept payments online via Stripe. Send invoice payment links directly from the app.",
  },
  {
    icon: "🤖",
    title: "AI Material Estimates",
    desc: "After your first completed job, AI suggests material quantities based on your own job history.",
  },
  {
    icon: "📦",
    title: "MegaPort — One-Click Migration",
    desc: "Transfer your entire history from QuickBooks, Jobber, Buildertrend, or any spreadsheet in a single upload. Clients, jobs, materials, labor — all at once.",
  },
];

const TESTIMONIALS = [
  {
    name: "Mike T.",
    location: "Portland, OR",
    trade: "Roofing Contractor",
    quote:
      "I caught a job going over budget before it was too late. The profit bar is the first thing I check every morning.",
  },
  {
    name: "Jason R.",
    location: "Vancouver, WA",
    trade: "General Contractor",
    quote:
      "Used to run three different apps and a notebook. Now it's all in one place. MegaPort pulled in four years of Jobber data in about ten minutes.",
  },
  {
    name: "Dave K.",
    location: "Bend, OR",
    trade: "Framing & Decking",
    quote:
      "The photo estimator saved me two hours on a deck quote. Snapped a picture, got a full material list. My crew still doesn't believe it.",
  },
];

const INCLUDED = [
  "Live job profitability tracking",
  "Receipt scanning with OCR",
  "Regional material pricing alerts",
  "Client portal",
  "GPS mileage & IRS tax export",
  "Custom report builder",
  "ACH & card payments via Stripe",
  "AI material estimates",
  "MegaPort: one-click migration from QuickBooks, Jobber & more",
];

const FAQ = [
  {
    q: "Is there really no credit card required?",
    a: "Yes — complete your first 3 jobs completely free. No payment info needed to start.",
  },
  {
    q: "What happens after the trial?",
    a: "$49.99 per month, cancel anytime. No contracts, no hidden fees.",
  },
  {
    q: "Does it work for my trade?",
    a: "It covers roofing, framing, restoration, electrical, plumbing, tile, decking, and more.",
  },
  {
    q: "Can I import my existing data?",
    a: "Yes — MegaPort imports from QuickBooks, Jobber, Leap, and most contractor software.",
  },
  {
    q: "Is my data safe?",
    a: "Yes — bank-level encryption. Your data is yours and you can export it anytime.",
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white">
      {/* Redirect PWA (standalone) users straight to the dashboard */}
      <StandaloneRedirect to="/jobs" />

      {/* Referral banner — shows when ?ref= param is in the URL */}
      <Suspense>
        <RefCapture />
      </Suspense>

      {/* ── Sticky nav ── */}
      <header className="sticky top-0 z-50 bg-[#0F0F0F]/90 backdrop-blur-md border-b border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Image
              src="/icons/brand-logo.png"
              alt="Sightline"
              width={240}
              height={130}
              className="h-9 w-auto"
              priority
            />
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#problem" className="hover:text-white transition-colors">Why Sightline</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
          </nav>

          {/* CTA buttons */}
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="min-h-[92vh] flex flex-col items-center justify-center text-center px-5 pt-16 pb-20">
        {/* Trial badge */}
        <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-1.5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">
            First 3 jobs free
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] mb-6 max-w-3xl">
          Every job.{" "}
          <span className="text-orange-500">One view.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-gray-400 text-lg sm:text-xl max-w-xl leading-relaxed mb-10">
          The job management app built by a working carpenter. Ditch the spreadsheets, the notebook,
          and the after-hours admin — for{" "}
          <span className="text-white font-semibold">$49.99/month.</span>
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xs sm:max-w-none">
          <Link
            href="/signup"
            className="w-full sm:w-auto bg-orange-500 text-white font-bold text-lg px-8 py-4 rounded-2xl hover:bg-orange-400 transition-colors active:scale-95 text-center"
          >
            Start Free Trial
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

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-3">
            How it works
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-md mx-auto">
            Three steps. That&rsquo;s it. Most contractors are up and running in under five minutes.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map(({ step, icon, title, desc }) => (
              <div key={step} className="relative bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-6 py-7 flex flex-col gap-4">
                {/* Step number */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                    <span className="text-white font-black text-sm">{step}</span>
                  </div>
                  <span className="text-3xl">{icon}</span>
                </div>
                <div>
                  <p className="text-white font-bold text-base leading-snug mb-2">{title}</p>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/signup"
              className="inline-block bg-orange-500 text-white font-bold text-base px-8 py-4 rounded-2xl hover:bg-orange-400 transition-colors active:scale-95"
            >
              Start Free — No Card Required
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-4">
            Everything you need. Built and working now.
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-md mx-auto">
            No waitlists, no &ldquo;coming soon.&rdquo; Every feature below is live in the app today.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-6 py-6 flex flex-col gap-3"
              >
                <span className="text-3xl">{icon}</span>
                <p className="text-white font-bold text-base leading-snug">{title}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── See it in action ── */}
      <section className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-3">
            See it in action
          </h2>
          <p className="text-gray-500 text-center mb-10">
            Walk through a live demo — no signup required.
          </p>

          {/* Video placeholder — replace inner content with embed when ready */}
          <div className="relative w-full bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-8" style={{ paddingBottom: "56.25%" }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#2a2a2a] border border-[#3a3a3a] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <polygon points="5,3 19,12 5,21" fill="#6B7280" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm font-medium">Demo video coming soon</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Link
              href="/demo"
              className="w-full sm:w-auto bg-orange-500 text-white font-bold text-lg px-10 py-5 rounded-2xl hover:bg-orange-400 transition-colors active:scale-95 text-center"
            >
              Try the live demo
            </Link>
            <p className="text-gray-600 text-sm">
              No account needed — explore every feature with sample data.
            </p>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-3">
            What contractors are saying
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-md mx-auto">
            Real feedback from the field — updated as we hear from more users.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ name, location, trade, quote }) => (
              <div
                key={name}
                className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-6 py-7 flex flex-col gap-5"
              >
                {/* Quote mark */}
                <span className="text-orange-500 text-4xl font-black leading-none select-none">&ldquo;</span>
                <p className="text-gray-300 text-base leading-relaxed flex-1">{quote}</p>
                <div className="border-t border-[#2a2a2a] pt-4">
                  <p className="text-white font-bold text-sm">{name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{location} · {trade}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-lg mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-3">
            Simple, honest pricing
          </h2>
          <p className="text-gray-500 text-center mb-10">
            One plan. Everything included. No tiers, no upsells.
          </p>

          {/* Trial banner */}
          <div className="bg-orange-500 rounded-t-2xl px-6 py-3 text-center">
            <p className="text-white font-bold text-sm tracking-wide">
              Complete your first 3 jobs free — no credit card required
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
                Field crew members always free — they never pay
              </p>
            </div>

            {/* CTA */}
            <Link
              href="/signup"
              className="block w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-2xl text-center hover:bg-orange-400 transition-colors active:scale-95"
            >
              Start Free Trial
            </Link>
            <p className="text-gray-600 text-xs text-center mt-3">
              No credit card · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-3">
            Frequently asked questions
          </h2>
          <p className="text-gray-500 text-center mb-12">
            Straight answers. No runaround.
          </p>

          <div className="flex flex-col gap-3">
            {FAQ.map(({ q, a }) => (
              <details
                key={q}
                className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl overflow-hidden group"
              >
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none select-none">
                  <span className="text-white font-semibold text-base pr-4">{q}</span>
                  {/* Chevron — rotates open via CSS group-open */}
                  <svg
                    className="shrink-0 text-gray-500 transition-transform duration-200 group-open:rotate-180"
                    width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <div className="px-6 pb-5">
                  <p className="text-gray-400 text-base leading-relaxed">{a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section id="about" className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
            Built for the people who build everything else
          </h2>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-7 py-7 text-left">
            <p className="text-gray-300 text-base leading-relaxed">
              Sightline was built by a carpenter who recognized a gap nobody had seriously tried to solve. Contractors are the backbone of every project, every neighborhood, and every structure people take for granted — and they deserve tools built specifically for how they actually work.
            </p>
            <p className="text-gray-400 text-base leading-relaxed mt-4">
              Every feature exists to save time on the job and money at the end of it. Not designed in a boardroom. Not built for investors. Built for the men and women who show up every day and keep the world moving.
            </p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 px-5 border-t border-[#1a1a1a] text-center">
        <div className="max-w-lg mx-auto">
          <Image
            src="/icons/brand-logo.png"
            alt="Sightline"
            width={240}
            height={130}
            className="h-14 w-auto mx-auto"
          />
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
            Start Free Trial
          </Link>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="py-20 px-5 border-t border-[#1a1a1a]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-3">
            Get in touch
          </h2>
          <p className="text-gray-500 text-center mb-4 max-w-md mx-auto">
            Questions about pricing, features, or getting started? We&rsquo;ll reply same day.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <a href="mailto:sightlinesupport@gmail.com" className="text-orange-400 font-semibold text-sm hover:text-orange-300 transition-colors">
              sightlinesupport@gmail.com
            </a>
            <span className="hidden sm:block text-gray-700">·</span>
            <a href="sms:9714697274" className="text-orange-400 font-semibold text-sm hover:text-orange-300 transition-colors">
              Text: 971-469-7274
            </a>
          </div>
          <ContactForm variant="landing" />

          <div className="mt-12 bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-7 py-8">
            <h3 className="text-white font-black text-xl mb-1">Share an idea</h3>
            <IdeaBox variant="landing" />
          </div>
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
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-gray-500 text-sm hover:text-white transition-colors">
              Terms of Service
            </Link>
          </nav>
        </div>
      </footer>

    </div>
  );
}
