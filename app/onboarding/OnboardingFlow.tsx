"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { upsertBusinessProfile } from "@/app/actions/business-profile";
import { createJob } from "@/app/actions/jobs";
import { completeOnboarding } from "@/app/actions/onboarding";

// ── Constants ─────────────────────────────────────────────────────────────────

const JOB_TYPES = [
  { value: "drywall",     label: "Drywall" },
  { value: "framing",     label: "Framing" },
  { value: "plumbing",    label: "Plumbing" },
  { value: "paint",       label: "Paint" },
  { value: "trim",        label: "Trim" },
  { value: "roofing",     label: "Roofing" },
  { value: "tile",        label: "Tile" },
  { value: "flooring",    label: "Flooring" },
  { value: "electrical",  label: "Electrical" },
  { value: "hvac",        label: "HVAC" },
  { value: "concrete",     label: "Concrete" },
  { value: "landscaping",  label: "Landscaping" },
  { value: "decks_patios", label: "Decks & Patios" },
];

// ── Small shared components ───────────────────────────────────────────────────

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={`h-1 rounded-full transition-all duration-300 ${
            s < step
              ? "flex-1 bg-orange-500"
              : s === step
              ? "flex-1 bg-orange-500"
              : "flex-1 bg-[#2a2a2a]"
          }`}
        />
      ))}
    </div>
  );
}

function StepLabel({ step }: { step: number }) {
  return (
    <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider mb-6">
      Step {step} of 3
    </p>
  );
}

const inputClass =
  "bg-[#242424] border border-[#333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 w-full";

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  required,
  onSkip,
  inputMode,
  type = "text",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  onSkip?: () => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
        {label}
        {required && <span className="text-orange-500 ml-1">*</span>}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="text-gray-600 text-xs self-start mt-0.5 active:text-gray-400"
        >
          Fill in later
        </button>
      )}
    </div>
  );
}

// ── Sightline logo mark ───────────────────────────────────────────────────────

function SightlineLogo({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} style={{ borderRadius: "22%" }}>
      <rect width="512" height="512" fill="#0F0F0F" />
      <polygon
        points="106,418 406,418 256,118"
        fill="none"
        stroke="white"
        strokeWidth="44"
        strokeLinejoin="miter"
      />
      <rect x="106" y="48" width="300" height="70" rx="10" fill="#0F0F0F" stroke="white" strokeWidth="12" />
      <path d="M 160 108 Q 256 62 352 108" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="256" cy="83" rx="28" ry="15" fill="#F97316" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | "done";

export default function OnboardingFlow({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1 fields
  const [bizName, setBizName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [license, setLicense] = useState("");
  const [phone, setPhone] = useState("");
  const [cityState, setCityState] = useState("");

  // Step 2 fields
  const [jobName, setJobName] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [jobTypes, setJobTypes] = useState<string[]>([]);

  function toggleJobType(v: string) {
    setJobTypes((prev) => prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]);
  }

  // ── Auto-navigate from done screen ───────────────────────────────────────
  useEffect(() => {
    if (step !== "done") return;
    const t = setTimeout(() => router.push("/jobs"), 2000);
    return () => clearTimeout(t);
  }, [step, router]);

  // ── Step 1: Business Setup ────────────────────────────────────────────────
  async function handleStep1() {
    if (!bizName.trim()) { setError("Business name is required."); return; }
    if (!ownerName.trim()) { setError("Your name is required."); return; }
    setError("");
    setSaving(true);

    const res = await upsertBusinessProfile({
      business_name: bizName.trim(),
      owner_name: ownerName.trim(),
      license_number: license.trim() || null,
      phone: phone.trim() || null,
      address: cityState.trim() || null,
    });

    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setStep(2);
  }

  // ── Step 2: First Job ─────────────────────────────────────────────────────
  async function handleStep2(skip = false) {
    if (!skip) {
      if (!jobName.trim()) { setError("Job name is required."); return; }
      if (jobTypes.length === 0) { setError("Select at least one job type."); return; }
    }
    setError("");
    setSaving(true);

    if (!skip && jobName.trim()) {
      const fd = new FormData();
      fd.set("name", jobName.trim());
      fd.set("address", jobAddress.trim());
      jobTypes.forEach((t) => fd.append("types", t));
      await createJob(fd);
    }

    setSaving(false);
    setStep(3);
  }

  // ── Step 3: Crew / Completion ─────────────────────────────────────────────
  async function handleFinish() {
    setSaving(true);
    await completeOnboarding();
    setSaving(false);
    setStep("done");
  }

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        title: "Join my team on Sightline",
        text: `Use invite code ${inviteCode} to join my team on Sightline. Download at sightline.one`,
      }).catch(() => {});
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <div
        className="fixed inset-0 z-[100] bg-[#0F0F0F] flex flex-col items-center justify-center px-6 text-center"
        onClick={() => router.push("/jobs")}
      >
        <SightlineLogo size={72} />
        <h1 className="text-white font-black text-3xl mt-8 mb-3 leading-tight">
          You&rsquo;re set up.
        </h1>
        <p className="text-orange-500 font-bold text-xl">Let&rsquo;s build something.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#0F0F0F] overflow-y-auto">
      <div
        className="min-h-screen flex flex-col px-5 py-10 max-w-md mx-auto"
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-10">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-white font-bold text-base">Sightline</span>
        </div>

        {/* Progress */}
        <ProgressDots step={step as number} />
        <StepLabel step={step as number} />

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="flex flex-col flex-1">
            <h1 className="text-white font-black text-3xl leading-tight mb-2">
              Let&rsquo;s set up your business
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              This appears on your quotes and invoices.
            </p>

            <div className="flex flex-col gap-5 flex-1">
              <Field
                label="Business Name"
                id="biz-name"
                value={bizName}
                onChange={setBizName}
                placeholder="Smith Contracting"
                required
              />
              <Field
                label="Your Name"
                id="owner-name"
                value={ownerName}
                onChange={setOwnerName}
                placeholder="John Smith"
                required
              />
              <Field
                label="License Number"
                id="license"
                value={license}
                onChange={setLicense}
                placeholder="CCB-12345"
                onSkip={() => setLicense("")}
              />
              <Field
                label="Phone"
                id="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={setPhone}
                placeholder="(503) 555-0100"
                onSkip={() => setPhone("")}
              />
              <Field
                label="City, State"
                id="city-state"
                value={cityState}
                onChange={setCityState}
                placeholder="Portland, OR"
                onSkip={() => setCityState("")}
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm mt-4 bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              onClick={handleStep1}
              disabled={saving}
              className="mt-8 w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-2xl active:scale-95 transition-transform disabled:opacity-60"
            >
              {saving ? "Saving…" : "Continue"}
            </button>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="flex flex-col flex-1">
            <h1 className="text-white font-black text-3xl leading-tight mb-2">
              Create your first job
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              You can add more details after setup.
            </p>

            <div className="flex flex-col gap-5 flex-1">
              <Field
                label="Job Name"
                id="job-name"
                value={jobName}
                onChange={setJobName}
                placeholder="Johnson Kitchen Remodel"
                required
              />
              <Field
                label="Address"
                id="job-address"
                value={jobAddress}
                onChange={setJobAddress}
                placeholder="123 Main St, Portland, OR"
                onSkip={() => setJobAddress("")}
              />

              <div>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
                  Job Type <span className="text-orange-500">*</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {JOB_TYPES.map((t) => {
                    const active = jobTypes.includes(t.value);
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => toggleJobType(t.value)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                          active
                            ? "bg-orange-500 border-orange-500 text-white"
                            : "bg-[#1A1A1A] border-[#2a2a2a] text-gray-300"
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm mt-4 bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              onClick={() => handleStep2(false)}
              disabled={saving}
              className="mt-8 w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-2xl active:scale-95 transition-transform disabled:opacity-60"
            >
              {saving ? "Saving…" : "Create Job"}
            </button>
            <button
              onClick={() => handleStep2(true)}
              disabled={saving}
              className="mt-3 w-full text-gray-500 font-semibold text-base py-3 active:text-gray-400"
            >
              I&rsquo;ll add jobs later
            </button>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div className="flex flex-col flex-1">
            <h1 className="text-white font-black text-3xl leading-tight mb-2">
              Add your team
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              Field members use this code to join your account.
            </p>

            {/* Invite code card */}
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-6 py-8 text-center mb-6">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">
                Your Invite Code
              </p>
              <p className="text-white font-black text-5xl tracking-[0.25em] font-mono leading-none mb-4">
                {inviteCode || "------"}
              </p>
              <p className="text-gray-600 text-xs">
                Share this with anyone joining your crew on Sightline
              </p>
            </div>

            <button
              onClick={handleShare}
              className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold text-base py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform mb-3"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share Invite Code
            </button>

            <div className="flex-1" />

            <button
              onClick={handleFinish}
              disabled={saving}
              className="w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-2xl active:scale-95 transition-transform disabled:opacity-60"
            >
              {saving ? "Finishing…" : "Done"}
            </button>
            <button
              onClick={handleFinish}
              disabled={saving}
              className="mt-3 w-full text-gray-500 font-semibold text-base py-3 active:text-gray-400"
            >
              I work solo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
