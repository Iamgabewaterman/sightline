import { createBrowserClient } from "@supabase/ssr";

function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type SupabaseClient = ReturnType<typeof makeClient>;
let _client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (!_client) _client = makeClient();
  return _client;
}
