# HafizAssist project instructions

- Keep all changes local unless the user explicitly asks for a push or deployment.
- For every delivered change batch, increment the visible version: V1, V2, V3, etc. This includes fixes and nonvisual changes, so the user can identify what they are testing.
- Version numbering restarted at V1 at the user's explicit request on 2026-10-10. Read the actual current value in `index.html` before editing; that file, not this sentence, is authoritative. Continue with V2, V3, etc.; never reuse or decrease a version unless the user explicitly requests another restart.
- Update the far-right header badge and its accessible label in `index.html`, and the matching `VERSION` constant in `public/sw.js`, in the same change batch. Keep the badge visible at the far right on desktop, mobile, and the test page, as required by the user's latest supplied project instructions.
- The badge must identify the loaded application. Do not replace it with a separately fetched latest-server version: that could falsely label cached code as current.
- Keep the title, shared controls, and visible version in `mobile.html` synchronized with `index.html`. Preserve `data-layout="mobile"` on the mobile document. Opening-page uniform font fitting applies only to that layout.
- Preserve offline caching. Do not force a service worker update or reload during recitation. Explain closing all app tabs and reopening when a cached older version remains visible.
- Do not write or run tests, builds as validation, browser smoke tests, or microphone tests unless explicitly requested. Reading code to make edits is allowed. Report that tests were not run.

## Product direction remembered for future work

- The owner wants to launch and promote Recite Al Quran as a free web app first. If meaningful usage grows, build standalone Android and iPhone apps; reuse the shared codebase where practical. Android is the first candidate, followed by iPhone. Do not start mobile app development just because this note exists.
- Reuse the Google OAuth account setup from Desktop-HafizAssist when accounts are approved. That app uses a Cloudflare Worker and D1, not Firebase. Keep this project's progress separate because its Quran word positions differ. Account implementation requires the owner's approval of the proposal in `docs/LAUNCH-AND-ACCOUNTS-PLAN.md`.
- On October 17, 2026, the owner chose to wait until sign-in is added before launching the new release. Do not publish the current guest-only V38 cleanup ahead of accounts. Account implementation is still awaiting approval of the proposal.
