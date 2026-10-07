# Security notes

## Credential rules

Only a Supabase publishable key belongs in this browser application. A project URL and publishable key are public configuration. Database passwords, `sb_secret_` keys, legacy `service_role` keys and private AI provider tokens must stay in trusted server-side configuration and outside Git.

Putting a secret in a browser environment variable does not protect it: values shipped to a browser remain visible. `.gitignore` only prevents new untracked local files from being added; it does not remove secrets already tracked or present in history.

Reference: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## Audit baseline — October 7, 2026

Repository: `yihengwang914-lgtm/ywang8377`  
Audited main commit: `cbcf47aef63cec560b312f06f5681eba6d0878f0`

- Repository visibility: public.
- Reviewed all 19 commits reachable from advertised branch references and 17 distinct file-content blobs, including historical HTML files.
- Pattern scanning and source review found no suspected private API tokens, Supabase secret/service-role keys, private keys or database credentials. The Supabase key found was publishable.
- This is a bounded review of fetched Git content; it does not establish absence of secrets in deleted/unreachable commits, forks, cached copies, hosting configuration, logs or external artifacts.
- No database data was changed and no live insert/delete test was performed.

## Confirmed access-control issue

The `public.vocabulary_data` table has RLS enabled, but the policy `Allow vocabulary access` applies to `public` for `ALL` operations with `USING (true)` and `WITH CHECK (true)`. Both `anon` and `authenticated` have SELECT, INSERT, UPDATE and DELETE grants. This allows unsigned visitors using the public configuration to read and modify the shared vocabulary, including deleting rows.

The browser has no sign-in flow. `device_user` is a shared label, not an authenticated owner identity. Hiding the frontend key or making this repository private would not enforce database authorization.

The automated Supabase security advisor returned no notices, but the manual policy review confirmed the permissive access above. An empty advisor result is not proof that authorization matches the intended product behavior.

Before broader operation, decide whether vocabulary editing is owner-only or deliberately public. Owner-only editing requires an authenticated administrative flow and matching table grants/RLS policies. User-specific libraries require authenticated ownership and per-user policies. Restricting anonymous writes immediately would stop the existing unsigned add/import/delete workflow, so this audit leaves the database unchanged pending that product decision.

## If a private credential is exposed

Revoke or rotate it promptly at the provider, replace affected deployments and remove it from current source. A new commit alone does not erase historical exposure. Preserve development evidence, and plan any necessary provider-supported cache cleanup or narrowly scoped history cleanup separately; never silently rewrite Git history.

The publishable key identified in this audit does not require rotation solely because it appears in public browser source. Fixing access policies is the relevant action for the confirmed shared-vocabulary issue.

The courseware integration reads its OpenAI key and upload token from server-side environment configuration; no credential values were found in its committed source. Its upload token protects the AI endpoint, but does not prevent callers from directly accessing the permissive vocabulary REST API or import RPC. No live AI upload was performed in this audit.
