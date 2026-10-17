# 3.3.2 acceptance, 17 October 2026

All AI requests use the server-held DeepSeek key and `deepseek-flash` with thinking disabled. The public metadata and a real image OCR request confirmed the same provider for text and vision. The client and repository contain no DeepSeek credential. The previous shared RMB 20 test ceiling and spent ledger remain unchanged.

## Real isolated account journey

A synthetic three-week course ZIP contained PDF, PPTX and DOCX lecture materials, one duplicate and one reading. Original text was available after 4.64 seconds; vocabulary completed after 10.56 seconds, with 39 terms, one course, correct weeks 1/2/3, one deduplicated file and one excluded reading. This is a small acceptance fixture, not a throughput guarantee for an entire real semester.

The mobile journey passed sign-in and first-use tour, attachment removal, refresh during import, cloud recovery, draft/focus preservation, cited explanation, key-point summary, English quiz without client-visible answers, grading and next question, persisted feedback after refresh, review plan, task completion and another-device recovery. Viewports: 320, 390, 768, 1440 pixels; mobile keyboard-height layout also checked.

Observed end-to-end API times on this run: explanation 3.91 s; summary 5.32 s; prepared three-question exercise 0.71 s; choice grading 0.55–0.68 s; review plan 2.91 s. A second regression using the exact reported phrase “出题带我复习吧” returned prepared questions in 1.00 s; targeted live short question 2.90 s; short-answer feedback 1.97 s; image OCR 1.56 s. Provider and network load will affect future timings.

## Focused regression checks

- Explicitly selecting the course placeholder remains unselected, including rerender, reload, late history responses and a legacy all-course thread pointer. Course-bound history remains saved separately.
- Vocabulary course/Week controls filter all-course Week independently. Changing range preserves already submitted progress. Controls are disabled while an answer is being saved, preventing delayed feedback from overwriting the next range.
- Evidence passage IDs resolve only inside current cited sources. Invented IDs remain rejected. Valid grounded questions survive a partially invalid batch; an entirely ungrounded batch still fails safely. Prepared answer auditing remains in place.
- Budget reservation/settlement, 16 isolated DeepSeek lanes, RMB 20 cap and denial of client access passed a rollback transaction. No real ledger rows were changed by this check.
- 111 unit tests passed. Security advisor results match the previous baseline: six private deny-all policy notices, four reviewed auth-checked functions, and the existing leaked-password-protection plan limitation. No RLS weakening or platform upgrade was made.
- Both published PDFs regenerated and all eight pages rendered and visually reviewed. Guide includes course/Week selection and current DeepSeek processing.

Temporary acceptance account and its records are removed after production verification. Formal users, course content and study progress remain intact.
