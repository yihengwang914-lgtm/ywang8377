# 3.4.0 acceptance — 17 October 2026

## Behavior

- Every course-bound substantive answer is assembled from structured points. Source passage IDs must exist in the current retrieval. A separate model call checks every point for support, relevance, attribution and fabricated requirements. Only approved points render; unstructured `reply` cannot bypass this check.
- Teacher facts remain distinct from cited authors, critical discussion and separately labelled hypothetical examples. Insufficient evidence returns an explicit saved explanation rather than importing external knowledge silently.
- Live questions independently check their correct option or short-answer reference. Prepared questions retain the existing pre-audit. Review plans independently reject invented teacher requirements; their text is presented as proposed study tasks.
- A course overview samples beginning/middle/end text sections across uploaded files, preserving exact source IDs and section ordinals. It considers at most 60 files, balanced across weeks, with approximately 12,000 characters of evidence. Coverage shows uploaded, sampled and cited files/weeks and unselected files. It never claims every page or unuploaded teaching content was reviewed.
- Query ranking uses meaningful disjunctive terms instead of requiring every word in a natural-language question. Owner, course and explicit Week remain database filters.
- Contradictory course codes are blocked before inference, including the first message of a selected-course conversation. Other-course conversation history is not supplied.

## Verification

122 unit tests passed, including invented quote IDs, valid-but-unrelated quotations, unsupported teacher claims, malformed/duplicate audit verdicts, wrong live answer indices, unsafe study-plan tasks, and unstructured-prose bypass.

`tests/overview-security.sql` passed in a rolled-back transaction. It covered 13 weeks, beginning/middle/end sampling, denial of another account's course, exclusion of another course owned by the same learner, anonymous denial, and long-question retrieval of Week 11. The new RPCs remain SECURITY INVOKER and use auth.uid(); RLS and JWT verification stay enabled. Security advisor results match the pre-existing baseline.

Real DeepSeek acceptance used one disposable account and synthetic materials: 14 source documents spanning Weeks 1–13 in one course, plus a second course containing a unique marker that must not leak. The final overview cited all 14 source documents and represented all 13 weeks. Fresh and existing-dialog cross-course requests returned 409 before inference. An absent quantum-entanglement topic and absent Week 52 did not produce invented lessons. Critical-source attribution distinguished an author's surveillance claim from a lecturer's criticism. A leading question asking for a false causation claim and invented exam scope was corrected using Week 11 evidence. A targeted live English application question and answer feedback passed. A proposed three-day review plan also passed the new safety audit.

Observed synthetic-run API times: course overview 7.21 s; ordinary cited questions 4.29–7.23 s; targeted live English exercise 4.32 s; absent Week 0.73 s; cross-course rejection 0.21–0.31 s; independently checked study plan 3.82 s. These are measured examples, not guarantees for large real courses or future model load.

The existing real registration → PDF/PPTX/DOCX ZIP → refresh recovery → explanation → summary → English exercise → feedback → review plan → another-device journey passed against the new backend. Browser checks passed at 320/390/768/1440 pixels, with source/coverage expansion, persistent answers after refresh, and visible mobile composer. Both PDFs were updated, all eight pages rendered and visually reviewed.

The temporary account is cleaned after production verification. Formal users and study progress are not reset. The original shared RMB 20 cap is preserved; there is no automatic recharge. Independent model auditing reduces errors but cannot guarantee factual correctness or complete source coverage.
