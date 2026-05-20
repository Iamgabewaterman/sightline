import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Client } from "@/types";
import ClientsClient from "./ClientsClient";

export default async function ClientsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clients } = await supabase
    .from("clients")
    .select("id, user_id, name, company, phone, email, address, notes, created_at")
    .eq("user_id", user.id)
    .order("name", { ascending: true })
    .returns<Client[]>();

  return <ClientsClient initialClients={clients ?? []} />;
}
