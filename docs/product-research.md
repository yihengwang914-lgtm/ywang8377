# CourseLex learning workflow decisions · 2026-10-17

The product spine is one student, separate courses, separate conversations, and a source-grounded learning loop. Keep the chat entry simple; tools belong in the course workspace. This document records research influences, not claims that external products were copied or fully integrated.

## Primary sources reviewed

- [HKUDS DeepTutor](https://github.com/HKUDS/DeepTutor): course/source-grounded tutoring, practice, recoverable workspaces. Apache-2.0 license verified; existing adapted prompt principles and license notice remain in THIRD_PARTY_NOTICES.md. New workspace code is original. We do not import its whole agent stack or its operational complexity.
- [StudyFetch Study Plan](https://sso.studyfetch.com/docs/docs/study-planning-progress/study-plan): syllabus and exam dates connect to a guided learning sequence. CourseLex implements a smaller path: confirm extracted dates, save course events, export a calendar, and open the corresponding learning conversation.
- [RemNote Exam Study Plan](https://help.remnote.com/en/articles/16081995-exam-study-plan): scheduled practice and progress toward an exam. CourseLex connects its existing evidence-grounded practice and weak-point review to editable course calendars.
- [Google notebook sources](https://support.google.com/gemininotebook/answer/16215270): notebook material stays together. CourseLex keeps each conversation course-bound and separates assignment threads; selected personal notes enter a conversation only when the learner chooses “Ask Lex”.

## Student journey implemented

1. Registration and brief optional first-use guide. Start semester planning to discuss candidate courses, official requirements, goals and available time. The assistant does not claim live university enrollment knowledge.
2. Select a course; import syllabus in the course calendar. Extracted events show original evidence and require confirmation. Missing or ambiguous dates stay blank. Recurring classes can be expanded into a bounded weekly series. Export .ics to Apple, Google or Outlook calendars.
3. Upload a whole Canvas ZIP. Keep readable teaching source before background glossary completion; skip readings/duplicates, preserve course/week assignment and refreshable progress.
4. Use a course conversation for preparation, explanations, summaries and English practice. Use separate assignment and exam topics. Quiz feedback waits for the learner before the next question.
5. Save explanations to notes; edit, preview, autosave and export Markdown. Concurrent changes cannot silently overwrite another device's note.
6. Add revision tasks to the calendar; completing linked tasks from either view synchronizes the saved plan. No background notification delivery is claimed.
7. Use official school services via links. [CityU's official Canvas guide](https://www.cityu.edu.hk/dlsupport/student-canvas_basic-guide.html) verifies the Canvas address. Users can add HTTPS links for any school.

## Email: working import and remaining integration boundary

Users may paste selected Gmail/Outlook/school messages after explicit consent. Extraction uses the existing budgeted AI API; exact evidence must be present. Nothing is scheduled before confirmation. Email text is not separately retained by CourseLex; confirmed calendar evidence is retained in the user's private account. The AI provider processes supplied content under its own terms.

Automatic inbox sync is not connected. It needs separately registered public OAuth apps, consent screens, verified redirect URLs and secure server-side token lifecycle. Never use the developer's connected mailbox credentials for students. Google marks [gmail.readonly as restricted](https://developers.google.com/workspace/gmail/api/auth/scopes); [restricted-scope production verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) can require additional review/assessment. Microsoft supports delegated [Mail.Read](https://learn.microsoft.com/graph/permissions-reference#mailread), subject to school tenant consent policies. Do not request Mail.Send or write access for read-only analysis. This setup is deferred until provider app ownership/configuration is supplied; the UI does not pretend an inbox is connected.

## Free-tier footprint

No new paid infrastructure or service purchase. Notes: 100/account, 600,000 total characters, 60,000/note. Events: 500/account. School links: 20/account. Quotas serialize writes per user. These are product limits, not promises of total free-platform capacity; actual shared database and egress usage remains in the existing administrator capacity view. Existing AI trial cap remains ¥20; no automatic top-ups.
