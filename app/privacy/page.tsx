import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Privacy Policy — Sightline",
};

const sections = [
  {
    title: "1. Information We Collect",
    content: [
      "Account information you provide directly: name, email address, business name, license number, phone number, and billing information.",
      "Job data you enter: job details, materials, labor logs, photos, receipts, documents, client information, and subcontractor records.",
      "Usage data: log data, device information, IP address, browser type, and pages visited.",
      "Location data when you actively use GPS features including drive tracking and job site photo coordinates — only collected when you use these features.",
      "Payment information through Stripe — we never store your full card number or bank account details directly.",
    ],
  },
  {
    title: "2. How We Use Your Information",
    content: [
      "Provide and improve the Sightline service.",
      "Process payments through Stripe.",
      "Send push notifications you have opted into.",
      "Generate AI-powered estimates and insights from your job history.",
      "Calculate regional material pricing to improve accuracy for all users in your area.",
      "Send transactional emails through Resend including invoices and receipts.",
      "Comply with legal obligations.",
      "We do not sell your personal information to third parties. We do not use your data for advertising purposes.",
    ],
  },
  {
    title: "3. Data Storage and Security",
    content: [
      "Your data is stored securely using Supabase with row-level security — you can only access your own data.",
      "All data is encrypted in transit using HTTPS.",
      "Payment processing is handled by Stripe, which is PCI DSS compliant.",
      "Photos and documents are stored in Supabase Storage with access controls.",
      "We retain your data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days except where retention is required by law.",
    ],
  },
  {
    title: "4. Data Sharing",
    content: [
      "Stripe — payment processing",
      "Supabase — database and storage hosting",
      "Vercel — application hosting",
      "Anthropic — AI-powered receipt scanning and insights",
      "Mapbox — GPS mileage and route calculation",
      "Resend — transactional email delivery",
      "Open-Meteo — weather data",
      "We do not share your client data, job data, or financial data with any other third parties. Your client portal data is only accessible via a unique token link you control.",
    ],
  },
  {
    title: "5. Your Rights",
    content: [
      "Access, correct, or delete your personal data at any time through your account settings.",
      "Export your data using the CSV export features built into the app.",
      "Opt out of push notifications in Settings at any time.",
      "Close your account by contacting us at gabew595@gmail.com.",
      "California residents have additional rights under CCPA including the right to know what data we collect and the right to deletion.",
    ],
  },
  {
    title: "6. Cookies",
    content: [
      "We use essential cookies only for authentication and session management.",
      "We do not use tracking or advertising cookies.",
    ],
  },
  {
    title: "7. Changes",
    content: [
      "We may update this policy and will notify you by email or in-app notification. Continued use after changes constitutes acceptance.",
    ],
  },
  {
    title: "8. Contact",
    content: [
      "Gabriel Waterman",
      "gabew595@gmail.com",
      "503-550-1603",
      "sightline.one",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="text-gray-400 text-2xl leading-none active:scale-95 transition-transform min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Back"
          >
            ←
          </Link>
          <Image
            src="/new-logo.png.png"
            alt="Sightline"
            width={1408}
            height={768}
            className="h-7 w-auto"
          />
        </div>

        {/* Title block */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">Effective date: April 2026 · Last updated: April 26, 2026</p>
          <p className="text-gray-500 text-sm mt-1">
            Sightline · <a href="https://sightline.one" className="text-orange-400 hover:text-orange-300 transition-colors">sightline.one</a> · <a href="mailto:gabew595@gmail.com" className="text-orange-400 hover:text-orange-300 transition-colors">gabew595@gmail.com</a> · 503-550-1603
          </p>
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <div
              key={section.title}
              className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5"
            >
              <h2 className="text-orange-500 font-bold text-base mb-3">{section.title}</h2>
              <ul className="flex flex-col gap-2">
                {section.content.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-300 text-sm leading-relaxed">
                    <span className="text-orange-500/60 mt-1 shrink-0">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-8 pt-6 border-t border-[#2a2a2a] flex flex-wrap gap-4 text-xs text-gray-600">
          <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-gray-400 transition-colors">Back to Sightline</Link>
        </div>
      </div>
    </div>
  );
}
