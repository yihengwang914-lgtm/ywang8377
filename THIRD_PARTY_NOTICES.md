# Third-party notices

## DeepTutor

The tutoring system prompt in `supabase/functions/courselex-glm-import/learning.js`
adapts selected instruction sentences from HKUDS/DeepTutor:

- `deeptutor/capabilities/mastery/prompts/en/mastery_loop.yaml`
- `deeptutor/capabilities/course_study/prompts/en/course_study.yaml`

Source: https://github.com/HKUDS/DeepTutor
Revision inspected: `6cf793bd868ba5ecbe64722936d4be8fab5a01df`.
Copyright: HKUDS and DeepTutor contributors.
License: Apache License, Version 2.0. The complete license is provided in
`assets/licenses/DeepTutor-Apache-2.0.txt`.

Changes: selected tutoring, source-boundary and evidence-based progress instructions
were shortened and adapted to CourseLex's single conversation, course-scoped retrieval,
server-side answer validation and spaced review. CourseLex does not include DeepTutor's
runtime, frontend or agent orchestration engine. No endorsement is implied.

Other bundled libraries retain their existing license notices.
