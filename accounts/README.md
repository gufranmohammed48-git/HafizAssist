# Recite Al Quran accounts

V41 setup status, October 17, 2026. **Account Worker deployed; Google credentials pending. No application tests run.** This is a separate Cloudflare Worker and D1 database for `recitealquran.com`; the existing static website continues to use its current Worker/build configuration. Do not point the account Worker at the site's root URL, R2 model domain, or the old HafizAssist database.

Reuses the Google OAuth/OIDC approach from `Desktop-HafizAssist/accounts`, with new cookies, prefixed tables, and this app's Quran coordinates. It does not copy, change, or import the old app's users/progress. Using the same Google OAuth client lets the same Google identities sign in, but visitors still complete sign-in on this domain; old session cookies cannot transfer between domains.

## Confirmed setup on October 17, 2026

- The owner saved the Google redirect URI `https://recitealquran.com/api/account/callback` on the existing OAuth client.
- The owner created the separate D1 database `recitealquran-accounts`, with Database ID `bc19d842-ecb3-443a-b363-3a4e2b4d955b`. This ID is now recorded in this folder's `wrangler.jsonc`; it is an identifier, not a secret.
- Cloudflare browser authorization succeeded for account `ee6f807515a3090ba957c1983f0484ec`.
- Remote migration `0001_recite_accounts.sql` succeeded on the new D1 database.
- Account Worker `recitealquran-accounts` was deployed with D1 binding `DB`, origin `https://recitealquran.com`, route `recitealquran.com/api/account*`, and version ID `760a1430-f7a1-4d67-a602-5141940a5d5e`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` still need to be added privately to that Worker. The matching frontend release has not been published, and live sign-in has not been tested.

## Remaining production setup

Perform these steps only as part of the approved release. Nothing in this folder creates cloud resources or publishes itself.

1. Install Node.js and, from this `accounts` folder, install the listed dependencies and sign in to the Cloudflare account that owns the new database and `recitealquran.com`:

   ```powershell
   npm install
   npx wrangler login
   ```

   These are separate from the static site's build. Do not change that site's build output from `dist` or upload this folder as static assets. The account Worker bundles `jose` server-side; it is not delivered to the browser.

2. Configure **these secrets on the new `recitealquran-accounts` Worker**, privately, using the same existing Google OAuth client values:

   ```powershell
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```

   In Google Cloud, open **Google Auth Platform → Clients → the existing Web application OAuth client**. Copy its Client ID and existing Client secret only into the corresponding private prompts. If the new Worker is already listed in Cloudflare, the dashboard alternative is **Workers & Pages → recitealquran-accounts → Settings → Variables and Secrets → Add → Secret**: add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` with those exact names. Do not add them to the static website Worker (`myproject`) or the R2 bucket. If the account Worker is not listed yet, use the `accounts` folder's Wrangler setup rather than editing another Worker.

   Use private prompts, never HTML, source files, a screenshot, or chat. Secret values are not in the old repository and are not copied by this implementation. Do not reset the old client's secret without coordinating its existing deployment. Keep the previous HafizAssist redirect URI if that app is still in use. Update consent branding, authorized domains, support/privacy links, and audience for this site where required. A client left in Testing permits only its configured test users. Only `openid email profile` is requested; no Drive, Gmail, or microphone permission is requested from Google.

3. Apply this new database's migration and deploy only this account Worker:

   ```powershell
   npm run migrate
   npm run deploy
   ```

   Its only route is `recitealquran.com/api/account*`. The existing website Worker must continue serving all other paths, and the `model.recitealquran.com` R2 configuration remains unchanged. Keep `/api/account*` excluded from CDN cache rules and from the application's offline cache. Do not enable public `workers.dev` or preview URLs for accounts; the configured production origin is enforced on every request.

4. Publish the matching static frontend release through its existing Cloudflare build. The owner chose to wait for sign-in before launching. Do not describe sign-in or synchronization as live until deployment actually succeeds. Account isolation, callback, sign-out/deletion, offline-to-online sync, and two-device conflict testing require the owner's explicit testing request under the project instructions.

The owner completed the database creation and Google redirect registration listed above. The deployment dependencies are installed locally with the bundled pnpm runtime, including the required esbuild/workerd package setup. Cloudflare browser authorization, the new database migration, and the account Worker deployment are complete. The frontend release and private Google Worker secret configuration remain pending. No application tests or validation builds were run. Keep the old app's Worker, `APP_ORIGIN`, database, and credentials unchanged.

## Behavior and data

- Guests can keep practicing without an account. First Google sign-in needs a connection. A Python/Node static server alone does not run this Worker or D1; local guest tracking remains available while account actions report that the service is unavailable. Production callbacks require the deployed HTTPS domain.
- The account service stores a Google subject ID, verified email, display name, session hashes, and one compact last-progress document per user. The document contains a page/surah/ayah/word position, Bismillah marker, correct/reviewed totals, and update time. It stores no microphone audio, recordings, raw phoneme output, transcripts, Teacher clips, per-word error history, preferences, or model files.
- Correct/reviewed totals describe the compact current practice snapshot, not a lifetime ledger or a recreated set of past word highlights. Resuming a saved position does not reconstruct prior error details. The frontend prompts before choosing a different account/browser position, and does not move an active recitation pointer automatically.
- All requests use same-origin cookies; there is no credentialed cross-origin API. Every write requires the configured `Origin`, a valid session, and `X-CSRF-Token`. The token is returned only by the authenticated, uncached `/me` response. Progress reads and all mutations also require `X-Account-User` to match the identity confirmed by `/me`; a cookie changed by another tab is rejected with `401`. This header only asserts the expected identity, never selects database ownership. Google account ownership comes only from a verified ID token's `sub`, never from a browser-supplied user ID or email.
- OAuth uses a ten-minute single-use state tied to a secure HttpOnly cookie, PKCE S256, a nonce, issuer/audience/signature/expiry verification through `jose`, and allowlisted return paths. Google tokens remain server-side and are discarded after sign-in. A new login rotates the current browser's session.
- Session cookies are `__Host-` scoped, Secure, HttpOnly, SameSite=Lax, with a 30-day expiry. The database contains only hashes of session tokens. Daily scheduled cleanup removes expired login flows and sessions. HTTPS, the exact configured domain, and cookies are required.
- Saves are local-first on the frontend and use an atomic version check in D1. Concurrent device changes return `409` with the current cloud copy; the user chooses rather than silently overwriting it. The service does not trust client timestamps for ownership or conflict resolution.
- Sign-out revokes the current browser session. **Delete account** removes this site's cloud profile, progress, and every session for that identity, and clears its cookie. It does not delete the Google account or data in Desktop-HafizAssist. The frontend also clears the current account checkpoint in this browser after deletion; separately saved guest practice and downloaded app/model files remain. Other devices can retain their own local copies until those site data are removed.
- The account database has ongoing personal data until the user deletes it. Cloudflare database backups, restore/retention policy, plan quotas, and account service availability are operator responsibilities. Check applicable D1/Worker quotas and configure suitable edge abuse protection for `/api/account/login` before wider promotion; do not log OAuth codes, cookies, or user progress.

## Frontend API contract

All responses have `Cache-Control: private, no-store`. Error responses are JSON with an `error` message. The service returns `503`/`configured:false` when required configuration is absent; guests remain usable. No CORS headers are emitted.

| Method and path | Input | Response |
| --- | --- | --- |
| `GET /api/account/me` | Cookie | `{ configured: true, user: { id, name, email } \| null, csrfToken: string \| null }` |
| `GET /api/account/login` | Optional `returnTo` query | Redirect to Google; returns to the app with `?account=connected` or `?account=error` |
| `GET /api/account/progress` | Cookie, `X-Account-User` | `{ progress: object \| null, version: number, updatedAt: number \| null }` |
| `PUT /api/account/progress` | JSON `{ expectedVersion, progress }`, cookie, `X-Account-User`, `X-CSRF-Token` | `{ version, updatedAt }`; stale version returns `409` with `{ error, progress, version, updatedAt }` |
| `POST /api/account/logout` | Cookie, `X-Account-User`, `X-CSRF-Token` | `{}` and expired session cookie |
| `DELETE /api/account/account` | Cookie, `X-Account-User`, `X-CSRF-Token` | `{}` and expired session cookie |

`/api/account/google` aliases `/login`; `DELETE /api/account` aliases the account deletion path. Google alone calls the callback. Allowed `returnTo` values are `/`, `/index.html`, `/mobile.html`, `/test.html`, and `/test2.html`; all other values become `/`. The root callback never accepts an arbitrary redirect URL.

```json
{
  "schema": 1,
  "position": {
    "page": 2,
    "surah": 2,
    "ayah": 1,
    "word": 0,
    "bismillah": false
  },
  "totals": { "correct": 8, "reviewed": 10 },
  "updatedAt": 1792267200000
}
```

`word` is the actual word-position coordinate supplied by this tracker's Quran data, **not** a copied Desktop-HafizAssist cursor or a page array offset. The adapter resolves those coordinates on resumption. `page` is 1–604, `surah` 1–114, `ayah` 1–286, and `word` 0–300; Bismillah is identified separately. Only these whitelisted fields are persisted. `updatedAt` inside progress is the browser's local snapshot time; the envelope's `updatedAt` is the server save time. A missing cloud document has version `0`; every successful save increments the cloud version.

## References

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Cloudflare Worker routes](https://developers.cloudflare.com/workers/configuration/routing/routes/)
- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
