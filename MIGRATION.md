# CourseLex AI accounts rollout

## Data preservation

The original `vocabulary_data` table remains intact (1,736 rows, pre-rollout fingerprint `22507d1359facccb90b6034e4096365e`). Its unsigned browser grants and permissive policy were removed. The original `studyProgress` local-storage key is never deleted or overwritten.

New accounts use `user_courses`, `user_vocabulary`, and server-only `user_upload_jobs`. All user tables enforce ownership through RLS and composite foreign keys. Courses support 1–52 weeks; archiving preserves words and progress. A course cannot be shortened below a week containing words.

## Personal migration

1. Register `ywang8377-c@my.cityu.edu.hk` and confirm its email.
2. Log in in the same browser used for the original site.
3. Open **课程设置 → 复制我的旧词库与学习进度**.

The server checks the confirmed address in `auth.users`, never user-editable metadata. Migration copies the original courses and words into the account; original rows are preserved. An atomic migration marker prevents repeated copies and binds the archive to the first verified owner. Each copied word retains `legacy_id` for the browser progress mapping. Local progress is copied only to words still marked `new`; retrying does not overwrite newer cloud progress. A local completion marker is separate from the original data. Progress stored on a different browser must be imported there.

## Auth configuration

- Email signup: enabled; confirm email: enabled; anonymous sign-ins: disabled.
- Minimum password: 8; secure email change and secure password change enabled.
- Site URL and exact redirect: `https://yihengwang914-lgtm.github.io/ywang8377/`.
- Custom SMTP must be configured before classmates can register. The default Supabase SMTP restricts delivery to project-team addresses. Never disable email confirmation to bypass this restriction: confirmed identity protects personal migration.
- The browser ships only the publishable key and a locally vendored, pinned Supabase JS 2.57.4 client. Secret keys and AI credentials stay in the Edge Function environment.

## AI imports

`courselex-user-import` retains the existing document extraction and signed recovery flow. Every POST validates the bearer session with Auth, checks the course through RLS, binds signed tasks to the user, and calls `import_user_vocabulary` with the user's bearer token. `verify_jwt=false` enables the custom Auth validation used by the handler; it does not grant anonymous POST access. The existing upload password is still required for preparing/uploading a document. A database lock enforces at most 10 tasks per user per rolling 24 hours. No live paid AI document was submitted during rollout.

Old import functions and teacher-demo assets are retained. The legacy personal importer can no longer write the archived table through its unsigned RPC. The teacher demo is a separate existing workflow, not the account-based trial UI.

## Verification

- `tests/isolation.sql` runs rollback-only fixtures for account isolation, forged owners, course-week integrity, deduplicated imports, personal migration, and anonymous denial. Run through the connected SQL tool; it creates no permanent users or words.
- `node --test tests/*.test.mjs` tests cloud progress, escaped content, logout cleanup, dynamic weeks, unsigned AI denial, foreign course denial, and signed-job ownership.
- After rollout, compare the archive fingerprint again and check Supabase advisors.
- Real email delivery, email confirmation links, recovery emails, and live paid AI extraction require operator-controlled credentials and end-to-end acceptance after SMTP is configured.

## Recovery

Frontend rollback must not reopen anonymous access to the archive. Keep the new database tables and their data. A rollback to the old unsigned frontend would have no cloud access; restore the account-capable UI instead, or provide a separately authenticated owner view. No destructive down migration is provided. Existing student data must be exported before any later schema removal.
