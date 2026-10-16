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
- Site URL and exact redirect: `https://www.courselexai.com/`.
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


## Conversation learning rollout - 2026-10-16

Apply `supabase/learning_assistant.sql` before deploying the new handler. It adds
`user_learning_sources`, `user_learning_chunks`, `user_learning_threads` and
`user_learning_reviews`; it does not replace or rewrite vocabulary or progress.
Import-job creation retains extracted teaching text before the temporary job is
cleared. Source hashes deduplicate identical text within the same course. A locked
per-user quota limits retained teaching text to 2,000,000 characters. Existing
cleared originals cannot be reconstructed from word lists: users re-upload those
lectures to enable grounded explanations; their old words remain usable.

Source reads use the user's bearer token and RLS. Thread/quiz answers and review
state are server-only. The handler validates ownership and course scope on every
operation; one locked, atomic commit saves grading and spaced-review state.
Client-supplied correct answers or grades are never accepted. Retries reuse request
IDs. Pausing a quiz does not mark any concept mastered. Threads and review state
are stored in the cloud, with only the last-open thread ID stored locally.

Deploy the function with all five files, including `learning.js`, and JWT
verification enabled. Publish frontend assets together. Rollback the UI/handler if
needed, retaining all new tables and sources. No destructive rollback is supplied.

Acceptance: 68 automated tests; rollback-only database isolation tests in
`tests/learning-security.sql`; actual paid-model explanation, summary, 3-question
quiz, choice/short-answer feedback, review plan and recovery; browser checks at
320/390/768/1440 pixels; mixed PDF/PPTX/DOCX ZIP with duplicate and reading exclusion.
Manual integration scripts use disposable QA account/session files under `/tmp`,
never production credentials or real students' coursework.


### 2026-10-16 · 旧课件兼容与课程识别修复

旧版本只保留生成的词库，任务清理后无法由词库还原完整课件。补回资料应导入原课件或用户自己的 Word 整理稿，只新增 `user_learning_sources` 与 `user_learning_chunks`，按用户和课程代码核对，避免重新生成或覆盖词汇、作答及复习进度。界面区分“词库存在”与“原文可问答”，后台整理时单独刷新来源元数据。

课程识别排除参考文献中的作者年份和普通英文年份，统一 Canvas 同一课号资料包的课程，识别 `W1_Canvas` 等周次。阅读材料或待确认文件不再提前创建空课程。
