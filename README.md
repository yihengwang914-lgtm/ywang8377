# CourseLex AI

Turn course vocabulary into structured study and practice.

CourseLex AI is a course-based English–Chinese vocabulary learning project created to help students understand difficult words and domain-specific terminology in their course materials.

Creator: I-Heng Wang  
Started: October 2026  
Version: 0.1.0 (pre-1.0 development version)

Copyright © 2026 I-Heng Wang. All rights reserved.

## Current functionality

The current website is displayed as **Semester Vocabulary**. It supports:

- Vocabulary organized by course and Week 1–13.
- Single-word entry and bulk import using `English | 中文` or tab-separated pairs, with duplicate filtering on bulk import.
- Multiple-choice practice and recognition practice.
- Known-word and unknown-word collections, with study progress saved in browser local storage.
- Shared vocabulary synchronization through Supabase.
- Protected courseware upload and AI glossary extraction through a Supabase Edge Function, requiring server-side configuration.

Courseware upload supports PDF, PPTX, DOCX and TXT through the new upload integration. Server configuration is required; see the existing setup and deployment instructions below. This audit did not test a live AI upload or verify its deployment readiness.

## Version status

`VERSION` records `0.1.0`. This is a pre-1.0 documentation baseline, not a claim that CourseLex AI V1.0 has been released. The project is still evolving, and access control must be reviewed before broader public operation. No release tag has been created.

## Repository structure

```text
index.html   Existing website: HTML, CSS and browser JavaScript
upload.js    Courseware upload interface
supabase/    AI import Edge Function source and SQL import RPC
README.md    Product overview and development notes
COPYRIGHT    Copyright and rights notice
VERSION      Development version identifier
SECURITY.md  Credential handling and access-control findings
.gitignore   Local credentials and development files excluded from new commits
```

No build step, package manager or framework is required. Serve the repository with a static web server, for example `python3 -m http.server 8000`, and open `http://localhost:8000`. Deployment requires serving `index.html` through a static host. The existing Supabase project supplies cloud vocabulary; the SQL import RPC is included, but the repository does not contain a complete database bootstrap.

## Data and configuration

The browser connects directly to Supabase's REST API. `index.html` contains the project URL and a browser publishable key. These are public client configuration, not server secrets. Never replace the publishable key with a `service_role` or `sb_secret_` key.

The cloud vocabulary is shared. Study progress is local to the browser and is not synchronized between devices. There is currently no sign-in or per-user vocabulary isolation. Review `SECURITY.md` before using the project with private materials or multiple untrusted users.

## AI-assisted development

This project was developed with AI assistance, including help generating and revising code and documentation. I-Heng Wang directs the product requirements and selects, integrates and revises the resulting implementation. This statement describes the development process; it does not assert exclusive rights over AI output or third-party materials. Keep human decisions, revisions, design records and Git commits as development evidence.

## Copyright and third-party materials

Copyright © 2026 I-Heng Wang. All rights reserved.

No open-source license is granted for original project materials. See `COPYRIGHT`. Any third-party software, course materials, imported vocabulary or other content remains subject to its own rights and terms. This notice is not evidence of a completed copyright registration, trademark registration or patent grant.

## Development records

Preserve existing commits and add new commits for future changes. Do not squash, force-push or rewrite the development history for cosmetic cleanup. Keep private backups of requirements, design drafts and dated development records. Secrets must never be committed; see `SECURITY.md` for incident handling.

## Courseware integration setup and deployment

首页的“上传课件”支持 PDF、PPTX、DOCX、TXT（单个文件最多 10 MB）。选择课程和 Week、输入上传口令后，OpenAI 整理中英文专业术语，自动加入对应词库；同周已有词汇跳过。结果附有课件出处和短引用，方便核对。PPTX / DOCX 的嵌入图片不能直接识别，需要先转换为 PDF。

### 首次启用

在此 Supabase 项目的 [Edge Functions → Secrets](https://supabase.com/dashboard/project/lgluwowzuwsabedbyblr/functions/secrets) 中添加：

| Name | Value |
| --- | --- |
| `OPENAI_API_KEY` | 从 [OpenAI API Keys](https://platform.openai.com/api-keys) 创建的 API 密钥；账户需要可用的 API 额度 |
| `UPLOAD_ACCESS_TOKEN` | 你自己保存的随机上传口令，至少 16 位；不要使用 OpenAI 密钥作为口令 |

可选：`OPENAI_MODEL`，默认 `gpt-4.1-mini`。替代模型必须支持 Responses API、文件输入、后台处理、严格 JSON Schema，以及至少 32,768 输出 token。

保存后，在上传页面点击“检查连接”。以后上传只需输入上传口令，不需要输入 API 密钥。API 密钥和口令绝不能放进 `index.html`、GitHub、聊天或前端存储。

### 处理与恢复

- 文件通过受上传口令保护的 `courseware-import` Edge Function 发送到 OpenAI Responses API。分析采用后台模式，页面定时检查任务并完成入库。
- 刷新页面后，同一浏览器标签页保留任务，可再次打开“上传课件”并点击“继续检查”。不要重复提交正在分析的文件。任务凭据有效期为 24 小时。
- 如果网络断开或入库暂时失败，点击“继续检查”会重试已存在的任务，不会再创建一次 AI 分析。任务凭据只授权访问这一份课件的分析结果。
- 若分析被截断、内容不可完整读取、模型拒绝或术语缺少中文释义 / 出处，本次不会导入，请拆分课件或转成 PDF 后重试。
- 无专业术语时，会显示零条结果，不会生成虚构词汇。
- 原课件会传给 OpenAI。后台响应使用 `store: true` 以支持任务恢复；数据处理与留存遵循 [OpenAI API 数据政策](https://developers.openai.com/api/docs/guides/your-data)。
- AI 的“完整读取”与术语判断可能有误，结果中的出处与引用用于复核，不构成百分之百覆盖保证。

### 部署文件

`index.html`、`upload.js` 部署到 GitHub Pages。

`supabase/functions/courseware-import/index.ts` 和 `core.js` 部署为同名 Edge Function。函数使用自定义认证：新建任务校验上传口令；恢复任务校验 HMAC 签名凭据。因此 `verify_jwt` 设为 `false`，函数本体执行认证。它不会把 OpenAI 密钥或服务器密钥返回浏览器。

`supabase/import_course_vocabulary.sql` 定义入库 RPC，采用 `SECURITY INVOKER`，遵循现有 RLS，使用事务和课程 / 周次锁保证并发与重复检查不会重复添加单词。不修改已有词汇、学习状态或表结构。

### 参考

- [OpenAI 文件输入](https://developers.openai.com/api/docs/guides/file-inputs)
- [OpenAI 结构化输出](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI 后台模式](https://developers.openai.com/api/docs/guides/background)
- [Supabase Edge Function 密钥配置](https://supabase.com/docs/guides/functions/secrets)
