# @equationalapplications/firebase-auth-supabase-bridge

Exchange a Firebase Auth token for a real Supabase session — no Supabase SSO add-on required.

## Why this package?

Supabase Auth's SSO integration requires a paid plan add-on. This package provides a free-tier
alternative: given a decoded Firebase token, it finds or creates the corresponding Supabase user
via the Admin API, then issues a real Supabase session using a magic-link OTP. The resulting
session token is a standard Supabase JWT, so auth hooks, RLS policies, and JWT claim enrichment
all work as normal.

## How it works

```
Firebase token (decoded)
        │
        ▼
  find Supabase user by email
        │
        ├── found → use existing user
        │
        └── not found → create user via Admin API
                             │
                             ▼
                     [onUserReady hook]
        │
        ▼
  generate magic-link OTP  (Admin API)
        │
        ▼
  verify OTP  →  real Supabase session
        │
        ▼
  { access_token, refresh_token, expires_in, token_type }
```

## Installation

```bash
npm install @equationalapplications/firebase-auth-supabase-bridge @supabase/supabase-js
```

## Usage

```ts
import { exchangeFirebaseTokenForSupabaseSession, AuthBridgeError } from "@equationalapplications/firebase-auth-supabase-bridge";
import { onCall, HttpsError } from "firebase-functions/v2/https";

export const exchangeToken = onCall(
  { region: "us-central1", enforceAppCheck: true, secrets: ["SUPABASE_SERVICE_ROLE_KEY"] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    try {
      return await exchangeFirebaseTokenForSupabaseSession({
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        firebaseUid: request.auth.uid,
        email: request.auth.token.email!,
        onUserReady: async (uid) => {
          // app-specific setup, e.g. bootstrap a free-tier subscription
          console.log("New Supabase user created:", uid);
        },
      });
    } catch (err) {
      if (err instanceof AuthBridgeError) {
        throw new HttpsError(err.code as never, err.message);
      }
      throw err;
    }
  }
);
```

## `onUserReady` hook

`onUserReady` is called **once**, immediately after a new Supabase user is created. It is **not**
called on subsequent logins when the user already exists. Use it for one-time setup such as:

- Bootstrapping a free-tier subscription row
- Sending a welcome email
- Provisioning default resources

```ts
onUserReady: async (supabaseUserId: string) => {
  await db.insert(subscriptions).values({ userId: supabaseUserId, plan: "free" });
}
```

## Required Supabase RPCs

The package calls two PostgreSQL RPC functions via the Supabase REST API. You must create them in
your database before using this package.

### `get_user_id_by_email(lookup_email text) → text`

Returns the UUID of the auth user with that email, or an empty string if not found.

```sql
create or replace function get_user_id_by_email(lookup_email text)
returns text
language sql security definer
as $$
  select id::text from auth.users
  where lower(email) = lower(lookup_email)
    and deleted_at is null
  limit 1;
$$;
```

### `get_auth_user_by_email(lookup_email text) → json`

Returns a JSON object `{ user_id, deleted_at }` including soft-deleted users, or `null` if not found.

```sql
create or replace function get_auth_user_by_email(lookup_email text)
returns json
language sql security definer
as $$
  select json_build_object(
    'user_id', id::text,
    'deleted_at', deleted_at
  )
  from auth.users
  where lower(email) = lower(lookup_email)
  limit 1;
$$;
```

## Error codes

| Code | Meaning |
|------|---------|
| `unauthenticated` | No valid authentication credentials provided |
| `failed-precondition` | Required input is missing or invalid (e.g. empty email, missing config) |
| `not-found` | A required resource could not be located |
| `internal` | An unexpected error occurred inside the bridge (RPC failure, session generation failure, etc.) |

Errors are thrown as `AuthBridgeError` instances, which extend `Error` and include a `code` property.

## API

### `exchangeFirebaseTokenForSupabaseSession(options)`

Main entry point. Finds or creates a Supabase user for the given Firebase identity, then returns a
valid Supabase session.

**Options:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `supabaseUrl` | `string` | ✓ | Your Supabase project URL |
| `supabaseServiceRoleKey` | `string` | ✓ | Supabase service role key (keep secret) |
| `firebaseUid` | `string` | ✓ | The Firebase UID from the decoded token |
| `email` | `string` | ✓ | The user's email address |
| `onUserReady` | `(uid: string) => Promise<void>` | — | Called once after new user creation |

**Returns:** `Promise<SupabaseSession>`

### `getSupabaseAdminClient(supabaseUrl, serviceRoleKey)`

Returns a cached `SupabaseClient` configured with `autoRefreshToken: false` and
`persistSession: false`. Suitable for server-side use.

### `AuthBridgeError`

```ts
class AuthBridgeError extends Error {
  readonly code: AuthBridgeErrorCode;
}
```

## Contributing

### Conventional Commits & automated releases

This repository uses [semantic-release](https://semantic-release.gitbook.io/) to publish to npm
automatically when commits land on `main`. A new npm version is only created when at least one
commit since the last release follows the
[Conventional Commits](https://www.conventionalcommits.org/) format. Plain commit messages are
ignored by the release pipeline.

#### Commit message format

```
<type>(<optional scope>): <short summary>

[optional body]

[optional footer(s)]
```

#### Types and their effect on the version number

| Type | When to use | Version bump |
|------|-------------|--------------|
| `feat` | A new user-facing feature | **minor** (1.x.0) |
| `fix` | A bug fix | **patch** (1.0.x) |
| `perf` | A performance improvement | **patch** |
| `refactor` | Code restructuring, no behaviour change | none |
| `docs` | Documentation only | none |
| `chore` | Tooling / dependency updates | none |
| `test` | Adding or fixing tests | none |
| `ci` | CI/CD changes | none |
| `BREAKING CHANGE` | Footer or `!` after type, e.g. `feat!:` | **major** (x.0.0) |

#### Examples

```
feat: add refresh-token rotation support
fix: handle deleted Supabase users correctly
feat!: rename exchangeToken option supabaseUrl to projectUrl

BREAKING CHANGE: the `supabaseUrl` option has been renamed to `projectUrl`
```

#### Triggering the first release

If no qualifying commit exists yet, push any `feat:` or `fix:` commit to `main` and the CI
release job will publish version `1.0.0` to npm automatically.

## License

MIT

