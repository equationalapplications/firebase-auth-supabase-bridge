import { test } from "node:test";
import assert from "node:assert/strict";
import { exchangeFirebaseTokenForSupabaseSession, AuthBridgeError } from "../exchange.js";

const SERVICE_ROLE_KEY = "test-service-role-key";

const testUser = {
  id: "supabase-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "user@example.com",
  email_confirmed_at: "2024-01-01T00:00:00Z",
  app_metadata: {},
  user_metadata: {},
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const sessionBody = {
  access_token: "access-token-123",
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "refresh-token-123",
  user: testUser,
};

const linkBody = {
  action_link: "http://example.com/link",
  email_otp: "123456",
  hashed_token: "hashed-token",
  redirect_to: "http://example.com",
  verification_type: "magiclink",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sequentialFetch(...responses: Response[]): typeof globalThis.fetch {
  let index = 0;
  return async () => {
    const response = responses[index++];
    if (!response) throw new Error(`Unexpected fetch call #${index}`);
    return response;
  };
}

test("happy path: returns session for existing user", async () => {
  globalThis.fetch = sequentialFetch(
    jsonResponse("supabase-user-id"),    // get_user_id_by_email → found
    jsonResponse(linkBody),               // generate_link
    jsonResponse(sessionBody),            // verifyOtp
  );

  const result = await exchangeFirebaseTokenForSupabaseSession({
    supabaseUrl: "https://test1.supabase.co",
    supabaseServiceRoleKey: SERVICE_ROLE_KEY,
    firebaseUid: "firebase-uid-123",
    email: "user@example.com",
  });

  assert.equal(result.access_token, "access-token-123");
  assert.equal(result.refresh_token, "refresh-token-123");
  assert.equal(result.expires_in, 3600);
  assert.equal(result.token_type, "bearer");
});

test("creates new user when not found", async () => {
  const newUser = { ...testUser, id: "new-user-id" };
  globalThis.fetch = sequentialFetch(
    jsonResponse(null),                          // get_user_id_by_email → not found
    jsonResponse(newUser, 201),                  // admin createUser → success
    jsonResponse(linkBody),                      // generate_link
    jsonResponse({ ...sessionBody, user: newUser }), // verifyOtp
  );

  const result = await exchangeFirebaseTokenForSupabaseSession({
    supabaseUrl: "https://test2.supabase.co",
    supabaseServiceRoleKey: SERVICE_ROLE_KEY,
    firebaseUid: "firebase-uid-123",
    email: "user@example.com",
  });

  assert.equal(result.access_token, "access-token-123");
  assert.equal(result.refresh_token, "refresh-token-123");
});

test("soft-delete recreate: recreates a soft-deleted user and returns session", async () => {
  const staleUser = {
    id: "00000000-0000-0000-0000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "user@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  };
  const recreatedUser = { ...testUser, id: "recreated-id" };

  globalThis.fetch = sequentialFetch(
    jsonResponse(null),                                                       // get_user_id_by_email → not found
    jsonResponse({ msg: "User already registered" }, 422),                    // createUser → 422
    jsonResponse({ user_id: "00000000-0000-0000-0000-000000000001", deleted_at: "2024-01-01T00:00:00Z" }), // get_auth_user_by_email → stale deleted
    jsonResponse(staleUser),                                                  // deleteUser → 200
    jsonResponse(recreatedUser, 201),                                         // createUser again → success
    jsonResponse(linkBody),                                                   // generate_link
    jsonResponse({ ...sessionBody, user: recreatedUser }),                    // verifyOtp
  );

  const result = await exchangeFirebaseTokenForSupabaseSession({
    supabaseUrl: "https://test3.supabase.co",
    supabaseServiceRoleKey: SERVICE_ROLE_KEY,
    firebaseUid: "firebase-uid-123",
    email: "user@example.com",
  });

  assert.equal(result.access_token, "access-token-123");
  assert.equal(result.refresh_token, "refresh-token-123");
});

test("throws AuthBridgeError(internal) when user cannot be created", async () => {
  globalThis.fetch = sequentialFetch(
    jsonResponse(null),                              // get_user_id_by_email → not found
    jsonResponse({ msg: "Internal error" }, 500),    // createUser → 500 error
  );

  await assert.rejects(
    () =>
      exchangeFirebaseTokenForSupabaseSession({
        supabaseUrl: "https://test4.supabase.co",
        supabaseServiceRoleKey: SERVICE_ROLE_KEY,
        firebaseUid: "firebase-uid-123",
        email: "user@example.com",
      }),
    (err: unknown) => {
      assert(err instanceof AuthBridgeError, "expected AuthBridgeError");
      assert.equal(err.code, "internal");
      return true;
    },
  );
});

test("throws AuthBridgeError(failed-precondition) when email is empty", async () => {
  await assert.rejects(
    () =>
      exchangeFirebaseTokenForSupabaseSession({
        supabaseUrl: "https://test5.supabase.co",
        supabaseServiceRoleKey: SERVICE_ROLE_KEY,
        firebaseUid: "firebase-uid-123",
        email: "",
      }),
    (err: unknown) => {
      assert(err instanceof AuthBridgeError, "expected AuthBridgeError");
      assert.equal(err.code, "failed-precondition");
      return true;
    },
  );
});

test("calls onUserReady with new user ID when a user is created", async () => {
  const newUser = { ...testUser, id: "new-user-id" };
  globalThis.fetch = sequentialFetch(
    jsonResponse(null),                               // get_user_id_by_email → not found
    jsonResponse(newUser, 201),                       // createUser → success
    jsonResponse(linkBody),                           // generate_link
    jsonResponse({ ...sessionBody, user: newUser }),  // verifyOtp
  );

  let readyUserId: string | null = null;
  await exchangeFirebaseTokenForSupabaseSession({
    supabaseUrl: "https://test6.supabase.co",
    supabaseServiceRoleKey: SERVICE_ROLE_KEY,
    firebaseUid: "firebase-uid-123",
    email: "user@example.com",
    onUserReady: async (uid) => {
      readyUserId = uid;
    },
  });

  assert.equal(readyUserId, "new-user-id");
});

test("does not call onUserReady when user already exists", async () => {
  globalThis.fetch = sequentialFetch(
    jsonResponse("supabase-user-id"),  // get_user_id_by_email → found
    jsonResponse(linkBody),             // generate_link
    jsonResponse(sessionBody),          // verifyOtp
  );

  let onUserReadyCalled = false;
  await exchangeFirebaseTokenForSupabaseSession({
    supabaseUrl: "https://test7.supabase.co",
    supabaseServiceRoleKey: SERVICE_ROLE_KEY,
    firebaseUid: "firebase-uid-123",
    email: "user@example.com",
    onUserReady: async () => {
      onUserReadyCalled = true;
    },
  });

  assert.equal(onUserReadyCalled, false);
});

test("returns session even when onUserReady throws", async () => {
  const newUser = { ...testUser, id: "new-user-id" };
  globalThis.fetch = sequentialFetch(
    jsonResponse(null),                               // get_user_id_by_email → not found
    jsonResponse(newUser, 201),                       // createUser → success
    jsonResponse(linkBody),                           // generate_link
    jsonResponse({ ...sessionBody, user: newUser }),  // verifyOtp
  );

  const result = await exchangeFirebaseTokenForSupabaseSession({
    supabaseUrl: "https://test8.supabase.co",
    supabaseServiceRoleKey: SERVICE_ROLE_KEY,
    firebaseUid: "firebase-uid-123",
    email: "user@example.com",
    onUserReady: async () => {
      throw new Error("onUserReady failed");
    },
  });

  assert.equal(result.access_token, "access-token-123");
  assert.equal(result.refresh_token, "refresh-token-123");
});

test("soft-delete recreate: throws when 422 user cannot be found by email lookup", async () => {
  globalThis.fetch = sequentialFetch(
    jsonResponse(null),                                                                               // get_user_id_by_email → not found
    jsonResponse({ msg: "User already registered" }, 422),                                           // createUser → 422
    jsonResponse(null),                                                                               // get_auth_user_by_email → not found (unexpected)
  );

  await assert.rejects(
    () =>
      exchangeFirebaseTokenForSupabaseSession({
        supabaseUrl: "https://test11.supabase.co",
        supabaseServiceRoleKey: SERVICE_ROLE_KEY,
        firebaseUid: "firebase-uid-123",
        email: "user@example.com",
      }),
    (err: unknown) => {
      assert(err instanceof AuthBridgeError, "expected AuthBridgeError");
      assert.equal(err.code, "internal");
      assert.match(err.message, /already registered but user could not be found/);
      return true;
    },
  );
});

test("soft-delete recreate: throws when deleteUser fails with non-404 error", async () => {
  const staleId = "00000000-0000-0000-0000-000000000009";
  globalThis.fetch = sequentialFetch(
    jsonResponse(null),                                                                               // get_user_id_by_email → not found
    jsonResponse({ msg: "User already registered" }, 422),                                           // createUser → 422
    jsonResponse({ user_id: staleId, deleted_at: "2024-01-01T00:00:00Z" }),                         // get_auth_user_by_email → stale deleted
    jsonResponse({ msg: "Service unavailable" }, 500),                                               // deleteUser → 500
  );

  await assert.rejects(
    () =>
      exchangeFirebaseTokenForSupabaseSession({
        supabaseUrl: "https://test9.supabase.co",
        supabaseServiceRoleKey: SERVICE_ROLE_KEY,
        firebaseUid: "firebase-uid-123",
        email: "user@example.com",
      }),
    (err: unknown) => {
      assert(err instanceof AuthBridgeError, "expected AuthBridgeError");
      assert.equal(err.code, "internal");
      assert.match(err.message, /Failed to delete soft-deleted Supabase user/);
      return true;
    },
  );
});

test("soft-delete recreate: throws when recreate createUser fails", async () => {
  const staleId = "00000000-0000-0000-0000-000000000010";
  const staleUser = { ...testUser, id: staleId };
  globalThis.fetch = sequentialFetch(
    jsonResponse(null),                                                                               // get_user_id_by_email → not found
    jsonResponse({ msg: "User already registered" }, 422),                                           // createUser → 422
    jsonResponse({ user_id: staleId, deleted_at: "2024-01-01T00:00:00Z" }),                         // get_auth_user_by_email → stale deleted
    jsonResponse(staleUser),                                                                          // deleteUser → 200
    jsonResponse({ msg: "Internal server error" }, 500),                                             // createUser again → 500
  );

  await assert.rejects(
    () =>
      exchangeFirebaseTokenForSupabaseSession({
        supabaseUrl: "https://test10.supabase.co",
        supabaseServiceRoleKey: SERVICE_ROLE_KEY,
        firebaseUid: "firebase-uid-123",
        email: "user@example.com",
      }),
    (err: unknown) => {
      assert(err instanceof AuthBridgeError, "expected AuthBridgeError");
      assert.equal(err.code, "internal");
      assert.match(err.message, /Failed to recreate Supabase user/);
      return true;
    },
  );
});
