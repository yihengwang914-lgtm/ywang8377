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

## Marked 18.0.14 and DOMPurify 3.4.17

The note reading view uses locally bundled Marked (MIT) for Markdown rendering
and DOMPurify (Apache-2.0 OR MPL-2.0) for an explicit HTML allowlist. Source bundles
are unmodified. The application configures rendering and sanitization separately.

- https://github.com/markedjs/marked — `assets/licenses/marked-18.0.14.txt`
- https://github.com/cure53/DOMPurify — `assets/licenses/dompurify-3.4.17.txt`

Pinned versions, npm tarball integrity and bundle SHA-256 hashes are recorded in
`vendor/note-renderer-provenance.json`. Runtime loads these from the application
origin; note text is not sent to a rendering service or CDN.
