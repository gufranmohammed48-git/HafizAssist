# Recite Al Quran: launch and accounts plan

Prepared October 17, 2026, America/New_York. The owner approved account implementation later that day. V39 introduced the local account frontend, separate Cloudflare Worker/D1 backend, setup instructions, and privacy page. V40 records the owner's new D1 database configuration and confirmed Google redirect registration. V41 initializes the new D1 schema and deploys the separate account Worker. Private Google Worker secrets are still required; the matching frontend and announcements remain unpublished. See `accounts/README.md` for the external setup still needed.

## Launch after Google sign-in is added

Publish the current working version as a free public beta at **recitealquran.com**, with the original Teacher recordings and timings. QUD remains an unused experiment on `test2.html`; it is not the production audio source. Keep desktop and mobile entries on the same release. Keep offline updates safe during recitation and retain a recoverable copy of the working release.

The owner chose on October 17 to **wait until sign-in is added before launching**. The owner has approved implementation, and the local settings cleanup and account code are prepared. The owner has created the new D1 database and saved the Google callback. The remote D1 migration and separate account Worker deployment are complete. Next configure its private Google credentials, then publish the matching static frontend through the existing Cloudflare setup. No successful live sign-in is claimed from the deployment alone. Share the approved launch announcement after deployment. Deployment and launch completion must be reported from actual results, not inferred from a local edit. No public messages are sent merely because draft copy appears here. Tests and browser checks require a separate explicit request under the project instructions.

Position the product as a Quran memorization companion with word tracking and reference audio. It offers five Teacher recitation choices across four reciters, English/Arabic interface options, and offline reading and recognition after the app and approximately 72.7 MB model have been saved successfully. Teacher audio needs a connection unless the particular reference clip is already cached; do not advertise a completely downloaded Quran audio library. Automatic tracking and Tajweed suggestions can be wrong and do not replace a qualified teacher.

Keep the launch free, without paid advertising, subscriptions, donations tied to access, or other monetization. Existing upstream code/model terms require a free, noncommercial service; those terms remain relevant even when accounts are added.

## Google accounts: approved and implemented locally in V39

The earlier Desktop-HafizAssist `accounts` implementation uses a **Cloudflare Worker and D1**, Google OAuth/OIDC, same-origin `/api/account` routes, and HttpOnly session cookies. It is currently configured for one origin. Reuse its authentication approach and, if approved, its existing Google OAuth client/project; Google credentials must remain secure server-side Worker secrets. Reusing the owner's Google account means reusing the configured provider project, never sharing the owner's personal login with visitors.

- **Desktop:** a beveled account icon immediately before the version badge. Production builds hide the badge and place the account icon at the far right; local previews and test pages keep their loaded version.
- **Mobile:** a compact account icon beside the version badge at the top right, with a **Sign in** label in its menu. It must not cover Quran text, displace the five reading controls, or obscure the version badge.
- **Entry flow:** one **Continue with Google** action handles both new and returning users. Guests retain the complete reading, recognition, and Teacher experience without registration.
- **Signed in:** show the account name, synchronization status, **Resume saved position**, and **Sign out**. Resume is explicit; remote changes never move a live reading pointer while the microphone is active.

The approved initial scope is **resume position and compact session totals only**: last page, surah, ayah, next-word position, update time, and correct/reviewed-word counts. Use new app-isolated records and explicit word coordinates; do not directly reuse the old app's cursor or assume its word indexing matches this app. Per-word history, charts, preference synchronization, and analytics infrastructure are outside this scope. Do not upload microphone audio, recordings, model files, or raw recognition transcripts.

Write locally first and synchronize small updates after meaningful progress, on stopping practice, and after connectivity returns. Debounce writes instead of making a network request for every word. Preserve offline guest practice; a first Google sign-in requires a connection. Before importing existing local progress into an account, ask which position to retain if the account already has a different saved position. Separate devices should not overwrite an active session silently.

The previous deployment used `hafizassist.com`. Use the prepared separate Recite Al Quran account Worker/route and isolated app storage, retaining the old app's configuration and data. The owner confirmed registering **`https://recitealquran.com/api/account/callback`** in Google Cloud and creating D1 database `recitealquran-accounts` with ID `bc19d842-ecb3-443a-b363-3a4e2b4d955b`; V40 records that ID in `accounts/wrangler.jsonc`. Configure the existing Google client credentials as secrets on the new `recitealquran-accounts` Worker. Configure the new app's origin deliberately; **do not blindly replace the old Worker's `APP_ORIGIN`**, which could break Desktop-HafizAssist. Enforce ownership checks on every progress read/write, provide data deletion, and preserve guest data appropriately on sign-out. The local routing, D1 schema, and migration are prepared in `accounts/`, but private Worker secrets, the remote migration, and account Worker deployment are still unconfirmed. Existing old-app cloud resources are not changed by these files.

## Launch messages for approval

**English**

Recite Al Quran is now available as a free public beta: https://recitealquran.com

Practice memorization with a Mushaf page, follow your recitation word by word, and turn on Teacher for a reference word when you pause or a word needs review. Choose from five recitation options. English and Arabic interfaces are available. Reading and recognition can work offline after the required files are saved; Teacher audio availability depends on downloaded clips.

Try a short passage and tell us where tracking needs improvement. Automatic feedback can be wrong and is a practice aid alongside learning with a qualified teacher.

**العربية**

أطلقنا النسخة التجريبية المجانية من «Recite Al Quran»: https://recitealquran.com

راجع حفظك من صفحة المصحف، وتابع تلاوتك كلمة بكلمة. يمكنك تفعيل المعلّم لسماع الكلمة عند التوقف أو عندما تحتاج إلى المراجعة، مع خمسة خيارات للتلاوة وواجهة عربية أو إنجليزية. تعمل القراءة والتعرّف على التلاوة دون اتصال بعد حفظ الملفات المطلوبة، أما الصوت المرجعي فيعتمد على المقاطع المحفوظة.

جرّب مقطعًا قصيرًا وأخبرنا بما يحتاج إلى تحسين. قد يخطئ التتبّع الآلي، وهو وسيلة للمراجعة ولا يغني عن التعلّم على يد معلّم متقن.

## First seven days: no paid promotion

1. Launch day: owner approves copy and shares the link with a small trusted memorization group. Ask for phone/browser, passage, and a short description of any issue.
2. Day 2: collect reports in one issue list; fix blocking problems before wider sharing.
3. Day 3: prepare a short screen demonstration showing search, recitation, and Teacher help, using reference or volunteered audio only with permission.
4. Day 4: owner seeks permission from relevant Quran teachers and community-group moderators before sharing. Do not send unsolicited bulk messages.
5. Day 5: publish a brief getting-started/offline guide and invite specific feedback.
6. Day 6: review volunteered tester feedback and any existing aggregate visit information cautiously; visitors can include bots. Do not add analytics infrastructure in this release.
7. Day 7: summarize what worked, remaining limitations, and the next release. Decide with the owner whether to widen the beta. Contact Quran Foundation separately when Tajweed is ready, as previously requested.

## Remembered product direction

The owner's stated plan is to build standalone **Android and iPhone apps if the web app attracts sustained use**. Keep a shared core for Quran display, tracking, and Teacher logic. Consider Android first, then iPhone; evaluate microphone reliability, model memory, offline storage, and background interruptions before choosing a wrapper or native implementation. iPhone builds can use cloud Mac infrastructure. Agree on the demand threshold with the owner using repeat practice, mobile demand, and feedback; no user-count threshold or delivery date has been promised.
