import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AuthBridgeError } from "./errors.js";

const clients = new Map<string, SupabaseClient>();

export function getSupabaseAdminClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  const key = supabaseUrl;
  const existing = clients.get(key);
  if (existing) return existing;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new AuthBridgeError("failed-precondition", "Missing supabaseUrl or serviceRoleKey.");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  clients.set(key, client);
  return client;
}
