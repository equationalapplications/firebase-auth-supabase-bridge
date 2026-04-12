import { getSupabaseAdminClient } from "./supabaseClient.js";
import { findSupabaseUserByEmail, createSupabaseUser } from "./userManagement.js";
import { getSupabaseUserSession } from "./session.js";
import { AuthBridgeError } from "./errors.js";
import type { SupabaseSession } from "./session.js";

export type { SupabaseSession };
export { AuthBridgeError };
export type { AuthBridgeErrorCode } from "./errors.js";

export interface ExchangeOptions {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  firebaseUid: string;
  email: string;
  onUserReady?: (supabaseUserId: string) => Promise<void>;
}

export async function exchangeFirebaseTokenForSupabaseSession(
  options: ExchangeOptions
): Promise<SupabaseSession> {
  const { supabaseUrl, supabaseServiceRoleKey, firebaseUid, email, onUserReady } = options;

  if (!supabaseUrl) {
    throw new AuthBridgeError("failed-precondition", "supabaseUrl is required.");
  }
  if (!supabaseServiceRoleKey) {
    throw new AuthBridgeError("failed-precondition", "supabaseServiceRoleKey is required.");
  }
  if (!email) {
    throw new AuthBridgeError("failed-precondition", "Email is required.");
  }

  const supabase = getSupabaseAdminClient(supabaseUrl, supabaseServiceRoleKey);

  let supabaseUserId: string | null = null;

  const found = await findSupabaseUserByEmail(supabase, email);
  if (found) {
    supabaseUserId = found.id;
  } else {
    const created = await createSupabaseUser(supabase, email, firebaseUid);
    if (created) {
      supabaseUserId = created.id;
      if (onUserReady) {
        try {
          await onUserReady(supabaseUserId);
        } catch (err) {
          console.error("onUserReady threw an error (session will still be returned):", err);
        }
      }
    }
  }

  if (!supabaseUserId) {
    throw new AuthBridgeError("internal", "Failed to find or create Supabase user.");
  }

  return getSupabaseUserSession(supabaseUrl, supabaseServiceRoleKey, email);
}
