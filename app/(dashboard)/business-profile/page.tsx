import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BusinessProfile } from "@/types";
import BusinessProfileSection from "@/app/(dashboard)/settings/BusinessProfileSection";

export default async function BusinessProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: businessProfile } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<BusinessProfile>();

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 pt-6 pb-8">
      <div className="max-w-lg mx-auto flex flex-col gap-5">
        <h1 className="text-2xl font-bold text-white">Business Profile</h1>
        <BusinessProfileSection initial={businessProfile ?? null} />
      </div>
    </div>
  );
}
