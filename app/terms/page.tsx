import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Terms of Service — Sightline",
};

const sections = [
  {
    title: "1. Acceptance",
    content: [
      "By creating an account or using Sightline you agree to these Terms of Service. If you do not agree, do not use the service.",
      "You must be at least 18 years old to use Sightline.",
    ],
  },
  {
    title: "2. Description of Service",
    content: [
      "Sightline is a job management platform for contractors providing tools for job tracking, estimating, invoicing, payment collection, GPS mileage tracking, receipt scanning, team management, and AI-powered insights.",
      "The service is provided as-is and we reserve the right to modify features at any time.",
    ],
  },
  {
    title: "3. Accounts",
    content: [
      "You are responsible for maintaining the security of your account and password.",
      "You are responsible for all activity that occurs under your account.",
      "You must provide accurate information when creating your account.",
      "You may not use Sightline for any illegal purpose or in violation of any applicable laws.",
    ],
  },
  {
    title: "4. Subscription and Payment",
    content: [
      "Sightline charges $49.99 per month after your 30-day free trial. No credit card is required during the trial.",
      "You may cancel at any time and will retain access until the end of your billing period.",
      "Field member accounts are free and do not require a subscription.",
      "We reserve the right to change pricing with 30 days notice to existing subscribers.",
      "Early subscribers who lock in pricing will be honored at their locked rate.",
    ],
  },
  {
    title: "5. Payment Processing",
    content: [
      "Invoice payments between contractors and their clients are processed directly through Stripe Connect.",
      "Sightline does not hold funds at any point — payments go directly from client to contractor.",
      "Stripe charges a processing fee of 2.9% plus $0.30 per transaction which is deducted from the contractor's received amount.",
      "Sightline is not responsible for disputes between contractors and their clients.",
    ],
  },
  {
    title: "6. Your Data",
    content: [
      "You own all data you enter into Sightline including job records, client information, photos, and documents.",
      "You grant Sightline a limited license to store and process your data to provide the service.",
      "We use aggregated and anonymized regional pricing data contributed by users to improve estimate accuracy — this never includes personally identifiable information.",
      "You are responsible for ensuring you have the right to upload any photos, documents, or data you add to the platform.",
    ],
  },
  {
    title: "7. AI Features",
    content: [
      "Sightline uses AI to provide material estimates, receipt scanning, and business insights.",
      "These features are provided as tools to assist your decision-making and should not be relied upon as the sole basis for financial decisions.",
      "AI estimates are based on historical data and regional averages and may not reflect your specific situation.",
      "Accuracy improves as you add more job data.",
    ],
  },
  {
    title: "8. Prohibited Use",
    content: [
      "Violate any law or regulation.",
      "Infringe on intellectual property rights.",
      "Upload malicious code or content.",
      "Attempt to gain unauthorized access to any system.",
      "Resell or sublicense the service.",
      "Use the service in any way that could damage or impair it.",
    ],
  },
  {
    title: "9. Termination",
    content: [
      "We reserve the right to suspend or terminate your account for violation of these terms.",
      "You may cancel your account at any time.",
      "Upon termination you may export your data within 30 days before it is deleted.",
    ],
  },
  {
    title: "10. Limitation of Liability",
    content: [
      "Sightline is provided as-is without warranty of any kind.",
      "We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.",
      "Our total liability to you shall not exceed the amount you paid us in the 12 months preceding the claim.",
      "We are not responsible for any disputes between you and your clients regarding work performed or payments.",
    ],
  },
  {
    title: "11. Governing Law",
    content: [
      "These terms are governed by the laws of the State of Oregon.",
      "Any disputes shall be resolved in the courts of Washington County, Oregon.",
    ],
  },
  {
    title: "12. Changes",
    content: [
      "We may update these terms and will notify you by email or in-app notification at least 14 days before changes take effect.",
      "Continued use after that date constitutes acceptance.",
    ],
  },
  {
    title: "13. Contact",
    content: [
      "Gabriel Waterman",
      "gabew595@gmail.com",
      "503-550-1603",
      "sightline.one",
    ],
  },
];

export default function TermsPage() {
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
          <h1 className="text-3xl font-black text-white mb-2">Terms of Service</h1>
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
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-gray-400 transition-colors">Back to Sightline</Link>
        </div>
      </div>
    </div>
  );
}
