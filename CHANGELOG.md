## [2.0.3](https://github.com/equationalapplications/firebase-auth-supabase-bridge/compare/v2.0.2...v2.0.3) (2026-04-16)


### Bug Fixes

* restore trailing newline in README ([8e8d88c](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/8e8d88c7b2ede8a07dbfec82a5b0f421b684d181))

## [2.0.2](https://github.com/equationalapplications/firebase-auth-supabase-bridge/compare/v2.0.1...v2.0.2) (2026-04-13)


### Bug Fixes

* address bridge review issues 1-6 ([6c26ecf](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/6c26ecfab68c398ff1d181be4f2bd39989bbb711))
* address reviewer feedback on validation order, silent null, log safety, and README cast ([81bd588](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/81bd5885c9cab43862511b7c2829fbaaa9177b1b))
* restore backward compat for getSupabaseUserSession — add overload accepting SupabaseClient ([e42c7b9](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/e42c7b94c358b47ea296c2d6f5049d86f7adf8dd))
* strengthen typeof validation in supabaseClient and session overload ([b383681](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/b383681cec8a62b6bcd5db710bb86ad9635160fd))
* throw AuthBridgeError when 422 user not found by email lookup ([a17e647](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/a17e647388cca2fe306da840656f4b3140688055))
* use SHA-256 hash of service role key in client cache key ([41f367c](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/41f367c66b849fa375afabd37ac9df7f8b8be444))
* validate resolvedEmail after overload dispatch in getSupabaseUserSession ([8d437de](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/8d437dee8f9273b6b9ab9eee620b1c3415ecf728))

## [2.0.1](https://github.com/equationalapplications/firebase-auth-supabase-bridge/compare/v2.0.0...v2.0.1) (2026-04-12)


### Bug Fixes

* add input validation for supabaseUrl and supabaseServiceRoleKey ([7374a6d](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/7374a6d929b84f3176f37c415dae61da55159817))

# [2.0.0](https://github.com/equationalapplications/firebase-auth-supabase-bridge/compare/v1.0.0...v2.0.0) (2026-04-12)


* feat!: rename npm package to @equationalapplications/firebase-auth-supabase-bridge ([86a2013](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/86a2013b5f84980f3bb735d6e95b2e2e55067cbd))


### BREAKING CHANGES

* Package has been renamed from `firebase-auth-supabase-bridge`
to `@equationalapplications/firebase-auth-supabase-bridge`. Update your
package.json dependency and all import statements. See the README migration
guide for details.

Co-authored-by: equationalapplications <65428263+equationalapplications@users.noreply.github.com>

# 1.0.0 (2026-04-12)


### Bug Fixes

* add missing semantic-release plugins to devDependencies ([9589139](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/9589139bdd6709f3c62ad74080a4109cad9310a6))
* bump engines.node to >=22.14 to match CI toolchain ([d1a3423](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/d1a34233224cee64a4fbe377719da6c59629f6e3))
* improve error messages and add CI workflow permissions ([0a06ce9](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/0a06ce970990849ed0e1e3e8a4ff6d8893555db3))


### Features

* implement firebase-auth-supabase-bridge npm package ([39be573](https://github.com/equationalapplications/firebase-auth-supabase-bridge/commit/39be573746e9645eb69c736f0c63f9d9249b8d64))
