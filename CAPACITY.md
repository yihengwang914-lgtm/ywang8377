# CourseLex AI 免费容量估算

核对日期：2026-10-14。

## 当前状态

- Supabase 数据库实际占用约 13 MB，免费额度 500 MB，当前约占 2.55%。
- 已注册 1 个账号；个人账号有 4 门课程、1,736 个词。`user_vocabulary` 连同索引约占 1.14 MB。
- 一个包含 1,736 个词的完整同步响应约 433 KB。
- GitHub Pages 网站本身很小，不保存用户上传的课件；数据库也不保存课件文件。

## 建议人数

建议先开放给 **200–300 名重度试用用户**。这里的“重度”按每人约 1,736 个词、每天完整打开并同步一次估算：

- 数据库存储约 300–350 MB，再加数据库固定开销、用户资料、统计和增长余量，仍在 500 MB 内。
- 每月 300 人 × 30 次 × 433 KB，完整词库同步约 3.9 GB；加上进度更新和管理请求后接近但仍可控制在 Supabase 5 GB 月度出口流量内。
- 若同学平均只保存 300–800 个词，数据库能容纳更多账号，但 5 GB 出口流量会比 50,000 MAU 更早成为限制。

这是保守运营上限，不是硬性并发上限。管理后台会实时显示数据库占用；达到 350 名活跃试用者或 70% 数据库占用时，应重新测量真实词数和流量。

## 免费平台额度

| 平台 | 免费额度/限制 | 对 CourseLex 的影响 |
| --- | --- | --- |
| Supabase | 500 MB 数据库、5 GB egress、50,000 MAU、500,000 次 Edge Function 调用/月 | 试用期主要受数据库和 egress 约束；账号数本身不是瓶颈 |
| GitHub Pages | 站点 1 GB、每月软性带宽 100 GB | 静态网页和两份 PDF 足够；通常不是瓶颈 |
| Brevo | 每天 300 封邮件 | 注册验证和重置密码共用；建议单日新增不超过约 250 人，给重置邮件留余量 |
| Cloudflare DNS | 当前 DNS/HTTPS 不需要额外套餐 | 已购买的域名续费除外 |
| AI 整理 | “用自己的 AI 整理”不消耗站长 API；“API 自动整理”可能产生模型费用 | 免费试用期应继续把“自己的 AI”作为主要入口，并控制共享上传口令 |

官方参考：[Supabase Billing](https://supabase.com/docs/guides/platform/billing-on-supabase)、[Supabase Edge Functions Pricing](https://supabase.com/docs/guides/functions/pricing)、[GitHub Pages Limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)、[Brevo Free Plan Limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)。
