import { createClient } from "@/lib/supabase/server";
import { Contact, CrewWithMembers, ContactCOI } from "@/types";
import PeopleClient from "@/components/PeopleClient";

export default async function PeoplePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: contacts }, { data: crews }, { data: coiRecords }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, user_id, name, phone, trade, hourly_rate, notes, avatar_path, is_subcontractor, created_at")
      .eq("user_id", user!.id)
      .order("name")
      .returns<Contact[]>(),
    supabase
      .from("crews")
      .select("*, crew_members(contact_id)")
      .eq("user_id", user!.id)
      .order("name")
      .returns<CrewWithMembers[]>(),
    supabase
      .from("contact_coi")
      .select("id, contact_id, user_id, carrier_name, policy_number, coverage_amount, expiration_date, document_path, created_at, updated_at")
      .eq("user_id", user!.id)
      .returns<ContactCOI[]>(),
  ]);

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">People</h1>
        <PeopleClient
          initialContacts={contacts ?? []}
          initialCrews={crews ?? []}
          initialCOIRecords={coiRecords ?? []}
        />
      </div>
    </div>
  );
}
