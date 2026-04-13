import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AuthBridgeError } from "./errors.js";

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export async function getSupabaseUserSession(supabaseUrl: string, serviceRoleKey: string, email: string): Promise<SupabaseSession>;
/** @deprecated Pass supabaseUrl and serviceRoleKey instead of a SupabaseClient instance. */
export async function getSupabaseUserSession(client: SupabaseClient, email: string): Promise<SupabaseSession>;
export async function getSupabaseUserSession(
  urlOrClient: string | SupabaseClient,
  keyOrEmail: string,
  email?: string
): Promise<SupabaseSession> {
  let supabase: SupabaseClient;
  let resolvedEmail: string;

  if (typeof urlOrClient === "string") {
    if (!urlOrClient || typeof keyOrEmail !== "string" || !keyOrEmail || typeof email !== "string" || !email) {
      throw new AuthBridgeError("failed-precondition", "supabaseUrl, serviceRoleKey, and email must be non-empty strings.");
    }
    supabase = createClient(urlOrClient, keyOrEmail, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    resolvedEmail = email;
  } else {
    supabase = urlOrClient;
    resolvedEmail = keyOrEmail;
  }
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: resolvedEmail.toLowerCase(),
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    throw new AuthBridgeError(
      "internal",
      `Failed to generate Supabase session link${linkError ? `: ${linkError.message}` : ""}.`,
    );
  }

  const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError || !sessionData?.session) {
    throw new AuthBridgeError(
      "internal",
      `Failed to verify Supabase session token${verifyError ? `: ${verifyError.message}` : ""}.`,
    );
  }

  const s = sessionData.session;
  return {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_in: s.expires_in,
    token_type: s.token_type,
  };
}
