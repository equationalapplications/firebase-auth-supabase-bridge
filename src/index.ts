export { getSupabaseAdminClient } from "./supabaseClient.js";
export {
  findSupabaseUserByEmail,
  findSupabaseUserByEmailIncludeDeleted,
  createSupabaseUser,
} from "./userManagement.js";
export { getSupabaseUserSession } from "./session.js";
export { exchangeFirebaseTokenForSupabaseSession } from "./exchange.js";
export type { ExchangeOptions, SupabaseSession, AuthBridgeErrorCode } from "./exchange.js";
export { AuthBridgeError } from "./errors.js";
