# 奇点 CourseLex AI · 对话学习助理

正式网站：https://www.courselexai.com/

上传课堂课件或 Canvas ZIP 后，在同一段对话里让莱克讲解知识点、整理重点、出题、批改并安排复习。每个账号和课程的数据隔离；选择题答案由服务器保存，提交前不下发给浏览器。讲解与批改附可核对的提取原文。旧词库、背词模式和进度继续保留。

当前实现：`learning-ui.js`、`materials.js`、`assistant.css`、`studio.css` 和 `supabase/functions/courselex-glm-import/`。数据库增量见 `supabase/learning_assistant.sql`，部署、旧课件重新上传和恢复说明见 [MIGRATION.md](MIGRATION.md)。免费容量及 AI 预算说明见 [CAPACITY.md](CAPACITY.md)。

- 单元与回归：`node --test tests/*.test.mjs`。
- 数据隔离验收：`tests/learning-security.sql`，事务最终回滚，不留下测试数据。
- 人工全流程验收：`scripts/test-learning-live.mjs` 和 `scripts/test-learning-browser.mjs`，使用独立 QA 账号，仅从 `/tmp` 读取临时测试会话。
- 界面验收：`node scripts/test-studio-ui.mjs`，使用固定教学示例检查 320/390/768/1440 像素宽度与对话卡片，不使用真实账号或付费模型。
- 用户指南与产品介绍：网站根目录两份 PDF；生成脚本 `scripts/create_learning_pdfs.py`。
- DeepTutor 提示规则复用与许可：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

管理员入口：https://www.courselexai.com/admin.html ，现有管理员权限校验继续生效。

---

以下是保留的历史版本说明，不代表当前默认上传和学习流程。

# CourseLex AI · 同学试用版

网站：https://www.courselexai.com/

邮箱注册、验证后登录、退出；首次登录填写用户名、学校和专业，之后可在“我的资料”修改。每个账号独立配置课程名称、简称、数量与 1–52 周。保留四选一、认识/不认识、生词本、熟词本、手动词库管理与 AI 课件整理。学习状态同步到个人云端。

管理员后台：https://www.courselexai.com/admin.html 。后台只允许 `courselex_private.admin_users` 中的账号访问，显示注册、活跃、使用时长、用户资料、课程/词汇概况和免费容量；普通用户无法通过 Data API 读取他人资料或后台统计。

个人旧数据保留，迁移步骤与部署配置见 [MIGRATION.md](MIGRATION.md)。同学注册需要配置 Supabase 自定义 SMTP。AI 上传保留原有上传口令，并增加会话验证与课程归属检查。

浏览器部署文件：`index.html`、`accounts.js`、`admin.html`、`admin.js`、`upload.js`、`vendor/supabase-2.57.4.js`。数据库结构：`supabase/courselex_accounts.sql`、`supabase/user_profiles_and_analytics.sql`、`supabase/admin_capacity_metrics.sql`；AI 函数：`supabase/functions/courselex-user-import/`。免费容量估算见 [CAPACITY.md](CAPACITY.md)。

以下为原版本的课件处理说明，原函数保留作历史参考；当前账号版使用上述新函数。

# Semester Vocabulary

Course vocabulary website: https://www.courselexai.com/

## 课件自动整理

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
- 上传前先保存任务编号，即使上传请求超时也可以恢复。若文件未完整上传，“继续检查”会显示“重试上传文件”；重新选择同一个文件和输入口令后可重试，同一任务最多创建一次 AI 分析。
- `courseware_upload_jobs` 仅后台服务可读写，保存恢复所需的任务状态，不保存课件内容、API 密钥或上传口令。
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

## 两种词表整理方式

首页同时提供“用自己的 AI 整理”和“API 自动整理”。前者复制提示词供用户在自己的 AI 中上传课件，支持粘贴两列词表及 TXT / TSV / JSON 文件导入；导入前预览并去重，不调用 AI API。后者保留原有课件自动整理和上传口令流程。两者都写入当前登录用户的词库，沿用同一云端学习进度。浏览器部署须包含 `own-ai.js`。
