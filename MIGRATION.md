## 3.1 英文题库、对话提速和首次引导（2026-10-16）

增量按顺序应用 `supabase/interactive_ai_performance.sql`、`supabase/interactive_ai_lanes.sql`、`supabase/question_banks.sql`、`supabase/first_use_guide.sql`。已有库已应用同名迁移；不要重复执行建表脚本。保留 20 元共享测试预算与已有账本，新增模型费率不重置额度。

部署 `courselex-glm-import` 的六个依赖文件：`index.ts`、`core.js`、`model.js`、`assistant.js`、`learning.js`、`question-bank.js`，保持 JWT 验证。对话使用 GLM-4-Air-250414，批量词表沿用原模型；对话和备题分通道。后台任务采用 `EdgeRuntime.waitUntil`，受平台时限限制；失败或中断有持久状态、租约与冷却，下次访问可恢复，不依赖用户电脑常开。

题库表仅服务器可读写，客户端拿不到答案。来源增删或周次更改使相应版本失效；旧对话、已答题和复习记录保留。取题以请求编号原子预留，网络重试不会消耗另一组题。普通练习用预备题；指定主题或简答等请求仍可实时生成。题目、选项使用英文，解析可中文；模型核验仍需结合课件复核。

原有账号迁移时不强制弹出新引导，可从“账户 → 功能引导”重看。新账号首次进入学习页显示三步引导，完成/跳过后记入自己的资料，浏览器本地也有按账号隔离的兜底记录。仅新增引导状态，不更改词库和学习进度。

验证：`node --test tests/*.test.mjs`，`tests/question-bank-security.sql`（事务回滚），`scripts/test-studio-ui.mjs`。生产环境使用隔离测试账号验证预备题取回、答案隐藏、批改、幂等与刷新恢复；测试账号会在验收后移除。

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

### 2026-10-17 · 新用户与手机流程验收

3.2 不增加或改写业务表。部署 `courselex-glm-import` 的全部六个文件并保留 JWT 验证，然后一起发布带版本参数的前端。明确课程元数据可跳过模型分类；模糊文件仍走分类流程。复习接口可在验证课程与复习项目归属后直接创建对话，不把其他课程问题带入。新讲解和计划会暂停旧练习，未答题目仍可继续。

浏览器本地保存上传原文件只用于中断恢复；云端保存任务、提取原文和结果。换设备能恢复已提交的任务与结果，尚未提交的原文件仍需重新选择。背景状态更新不重建正在阅读的对话，也不丢弃输入草稿。没有修改原用户词库、作答或学习进度。

## 3.3 课程空间增量

按顺序应用 course_workspace、course_workspace_task_sync、course_workspace_planning 三份 SQL。新增 notes/events/links 表和 thread purpose；旧对话默认 study。任务同步扩展保留原有 service-only commit RPC 权限，客户端仍不能取得未作答的答案。新表按账号 RLS，课程与归属账号使用复合外键。没有复制、覆盖或删除旧资料的迁移步骤。

回退前端时保留新表与列，旧功能仍可使用。若回退 Edge Function，保留 service-only commit RPC 即可；不运行 DROP TABLE、不还原用户笔记或进度。笔记版本冲突时保留本机编辑内容，由用户导出或另存，不自动选择覆盖方向。学校链接只允许 HTTPS，使用 noopener/noreferrer；不会收集学校登录密码。
