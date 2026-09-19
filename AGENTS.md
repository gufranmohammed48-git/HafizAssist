# HafizAssist project instructions

- Keep all changes local unless the user explicitly asks for a push or deployment.
- For every delivered change batch, increment the visible version: V1, V2, V3, etc. This includes fixes and nonvisual changes, so the user can identify what they are testing.
- The current version is V1. Read the actual current value in `index.html` before editing; that file, not this sentence, is authoritative. Never reuse or decrease a version.
- Update the far-right header badge and its accessible label in `index.html`, and the matching `VERSION` constant in `public/sw.js`, in the same change batch. Keep the badge visible at the far right on desktop and mobile.
- The badge must identify the loaded application. Do not replace it with a separately fetched latest-server version: that could falsely label cached code as current.
- Preserve offline caching. Do not force a service worker update or reload during recitation. Explain closing all app tabs and reopening when a cached older version remains visible.
- Do not write or run tests, builds as validation, browser smoke tests, or microphone tests unless explicitly requested. Reading code to make edits is allowed. Report that tests were not run.
