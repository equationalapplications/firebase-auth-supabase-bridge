import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthBridgeError } from "./errors.js";

export async function findSupabaseUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase.rpc("get_user_id_by_email", {
    lookup_email: email.toLowerCase(),
  });
  if (error) throw new AuthBridgeError("internal", `Failed to look up user by email: ${error.message}`);
  if (typeof data === "string" && data.length > 0) return { id: data };
  return null;
}

export async function findSupabaseUserByEmailIncludeDeleted(
  supabase: SupabaseClient,
  email: string
): Promise<{ id: string; deletedAt: string | null } | null> {
  const { data, error } = await supabase.rpc("get_auth_user_by_email", {
    lookup_email: email.toLowerCase(),
  });
  if (error) throw new AuthBridgeError("internal", `Failed to look up user by email: ${error.message}`);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    const id = record["user_id"];
    if (typeof id === "string" && id.length > 0) {
      const deletedAt = typeof record["deleted_at"] === "string" ? record["deleted_at"] : null;
      return { id, deletedAt };
    }
  }
  return null;
}

export async function createSupabaseUser(
  supabase: SupabaseClient,
  email: string,
  firebaseUid: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { firebaseUid },
  });

  if (error) {
    if (error.status === 422) {
      const existing = await findSupabaseUserByEmailIncludeDeleted(supabase, email);
      if (!existing) return null;
      if (!existing.deletedAt) return { id: existing.id };

      const { error: deleteError } = await supabase.auth.admin.deleteUser(existing.id, false);
      if (deleteError && deleteError.status !== 404) return null;

      const { data: recreated, error: recreateError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { firebaseUid },
      });
      if (recreateError || !recreated?.user) return null;
      return { id: recreated.user.id };
    }
    return null;
  }

  if (!data?.user) return null;
  return { id: data.user.id };
}
