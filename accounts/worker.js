import { createRemoteJWKSet, jwtVerify } from 'jose';

// Keep this service isolated from Desktop-HafizAssist, including its cookies.
const SESSION_COOKIE = '__Host-recite_session';
const FLOW_COOKIE = '__Host-recite_login';
const SESSION_SECONDS = 30 * 86400;
const FLOW_SECONDS = 600;
const MAX_BODY_BYTES = 8192;
const RETURN_PATHS = new Set(['/', '/index.html', '/mobile.html', '/test.html', '/test2.html']);
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const encoder = new TextEncoder();

function json(value, status = 200, extraHeaders = {}) {
  return Response.json(value, { status, headers: {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...extraHeaders,
  } });
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

function readCookie(request, name) {
  for (const item of (request.headers.get('Cookie') || '').split(';')) {
    const separator = item.indexOf('=');
    if (separator > -1 && item.slice(0, separator).trim() === name) return item.slice(separator + 1).trim();
  }
  return '';
}

const hex = bytes => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const hash = async value => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
const isToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function sameToken(actual, expected) {
  if (!isToken(actual) || !isToken(expected)) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function redirect(target, setCookies = []) {
  const headers = new Headers({
    Location: target,
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
  for (const value of setCookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 303, headers });
}

function appOrigin(env) {
  try {
    const value = new URL(env.APP_ORIGIN);
    // Never derive OAuth callbacks from the Host header or forwarded headers.
    if (value.protocol !== 'https:' || value.username || value.password || value.pathname !== '/' || value.search || value.hash) return null;
    return value.origin;
  } catch { return null; }
}

function returnPath(value) {
  return RETURN_PATHS.has(value) ? value : '/';
}

function accountReturn(origin, path, result) {
  const target = new URL(returnPath(path), origin);
  target.searchParams.set('account', result);
  return target.href;
}

async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) throw new Error('Invalid content type');
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES || !request.body) throw new Error('Invalid body');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let length = 0, text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_BODY_BYTES) { await reader.cancel(); throw new Error('Body too large'); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}

const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

function cleanProgress(value) {
  if (!value || value.schema !== 1 || !value.position || !value.totals) return null;
  const p = value.position, t = value.totals;
  if (!integer(p.page, 1, 604) || !integer(p.surah, 1, 114) || !integer(p.ayah, 1, 286) ||
      !integer(p.word, 0, 300) || typeof p.bismillah !== 'boolean' ||
      !integer(t.correct, 0, 1000000000) || !integer(t.reviewed, 0, 1000000000) ||
      !integer(value.updatedAt, 0, Number.MAX_SAFE_INTEGER)) return null;
  // Whitelist only the approved resume position and compact totals. In
  // particular, never persist a transcript, recording, or browser user ID.
  return {
    schema: 1,
    position: { page: p.page, surah: p.surah, ayah: p.ayah, word: p.word, bismillah: p.bismillah },
    totals: { correct: t.correct, reviewed: t.reviewed },
    updatedAt: value.updatedAt,
  };
}

async function authenticate(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!isToken(token)) return null;
  const user = await env.DB.prepare(`
    SELECT u.id, u.name, u.email FROM recite_sessions s
    JOIN recite_users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(await hash(token), Date.now()).first();
  return user ? { user, token, csrfToken: await hash(`csrf:${token}`) } : null;
}

async function savedProgress(env, userId) {
  const row = await env.DB.prepare('SELECT payload, version, updated_at FROM recite_progress WHERE user_id = ?')
    .bind(userId).first();
  return {
    progress: row ? JSON.parse(row.payload) : null,
    version: row?.version || 0,
    updatedAt: row?.updated_at || null,
  };
}

async function login(request, env, origin) {
  const url = new URL(request.url);
  const state = randomToken(), nonce = randomToken(), verifier = randomToken();
  const previousState = readCookie(request, FLOW_COOKIE);
  const statements = [];
  if (isToken(previousState)) statements.push(env.DB.prepare('DELETE FROM recite_oauth_states WHERE state_hash = ?').bind(await hash(previousState)));
  statements.push(env.DB.prepare(`
    INSERT INTO recite_oauth_states (state_hash, nonce, verifier, return_to, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(await hash(state), nonce, verifier, returnPath(url.searchParams.get('returnTo')), Date.now() + FLOW_SECONDS * 1000));
  await env.DB.batch(statements);
  const target = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  target.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/api/account/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state, nonce,
    code_challenge: base64url(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return redirect(target.href, [cookie(FLOW_COOKIE, state, FLOW_SECONDS)]);
}

async function callback(request, env, origin) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const failed = path => redirect(accountReturn(origin, path, 'error'), [cookie(FLOW_COOKIE, '', 0)]);
  if (!sameToken(state, readCookie(request, FLOW_COOKIE))) return failed('/');
  // Consume a browser-bound flow exactly once, including failed provider returns.
  const flow = await env.DB.prepare(`
    DELETE FROM recite_oauth_states WHERE state_hash = ? AND expires_at > ? RETURNING *
  `).bind(await hash(state), Date.now()).first();
  if (!flow) return failed('/');
  if (url.searchParams.has('error') || !url.searchParams.get('code')) return failed(flow.return_to);
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code: url.searchParams.get('code'),
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${origin}/api/account/callback`,
        grant_type: 'authorization_code',
        code_verifier: flow.verifier,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return failed(flow.return_to);
    const tokens = await response.json();
    if (typeof tokens.id_token !== 'string') return failed(flow.return_to);
    const { payload: claims } = await jwtVerify(tokens.id_token, googleKeys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: env.GOOGLE_CLIENT_ID,
      algorithms: ['RS256'],
      maxTokenAge: '10m',
      clockTolerance: 5,
    });
    if (!sameToken(claims.nonce, flow.nonce) || claims.email_verified !== true ||
        typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 ||
        typeof claims.email !== 'string' || !claims.email || claims.email.length > 254 ||
        (claims.azp && claims.azp !== env.GOOGLE_CLIENT_ID)) return failed(flow.return_to);
    const now = Date.now(), token = randomToken();
    const statements = [
      env.DB.prepare(`
        INSERT INTO recite_users (id, email, name, created_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name
      `).bind(claims.sub, claims.email, String(claims.name || 'Reader').slice(0, 100), now),
      env.DB.prepare('INSERT INTO recite_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
        .bind(await hash(token), claims.sub, now + SESSION_SECONDS * 1000),
    ];
    const oldToken = readCookie(request, SESSION_COOKIE);
    if (isToken(oldToken)) statements.push(env.DB.prepare('DELETE FROM recite_sessions WHERE token_hash = ?').bind(await hash(oldToken)));
    await env.DB.batch(statements);
    // Only the session cookie leaves the server. Google tokens are not stored.
    return redirect(accountReturn(origin, flow.return_to, 'connected'), [
      cookie(SESSION_COOKIE, token, SESSION_SECONDS), cookie(FLOW_COOKIE, '', 0),
    ]);
  } catch { return failed(flow.return_to); }
}

async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (path !== '/api/account' && !path.startsWith('/api/account/')) return json({ error: 'Not found.' }, 404);
  const origin = appOrigin(env);
  if (!origin || !env.DB || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({ configured: false, user: null, error: 'Accounts are not configured yet.' }, 503);
  }
  if (url.origin !== origin) return json({ error: 'Use the website account address.' }, 403);
  const mutation = !['GET', 'HEAD'].includes(request.method);
  if (mutation && request.headers.get('Origin') !== origin) return json({ error: 'Request origin rejected.' }, 403);
  if (request.method === 'GET' && ['/api/account/login', '/api/account/google'].includes(path)) return login(request, env, origin);
  if (request.method === 'GET' && path === '/api/account/callback') return callback(request, env, origin);

  const account = await authenticate(request, env);
  if (request.method === 'GET' && path === '/api/account/me') {
    return json({ configured: true, user: account?.user || null, csrfToken: account?.csrfToken || null });
  }
  if (!account) return json({ error: 'Please sign in again.' }, 401);
  if ((mutation || path === '/api/account/progress') && request.headers.get('X-Account-User') !== account.user.id) {
    // A second tab may have replaced this browser's cookie since /me was read.
    // This header asserts the UI's confirmed identity; it never selects an owner.
    return json({ error: 'Your account changed. Please reopen your account and try again.' }, 401);
  }
  if (mutation && !sameToken(request.headers.get('X-CSRF-Token'), account.csrfToken)) return json({ error: 'Please reopen your account and try again.' }, 403);
  const { user } = account;

  if (request.method === 'GET' && path === '/api/account/progress') return json(await savedProgress(env, user.id));
  if (request.method === 'PUT' && path === '/api/account/progress') {
    let data;
    try { data = await readJson(request); } catch { return json({ error: 'Invalid progress.' }, 400); }
    const progress = cleanProgress(data?.progress);
    if (!progress || !integer(data.expectedVersion, 0, Number.MAX_SAFE_INTEGER - 1)) return json({ error: 'Invalid progress.' }, 400);
    const updatedAt = Date.now(), payload = JSON.stringify(progress);
    // Compare-and-swap is atomic in D1. A second device never silently wins.
    const row = data.expectedVersion === 0
      ? await env.DB.prepare(`
          INSERT INTO recite_progress (user_id, payload, version, updated_at) VALUES (?, ?, 1, ?)
          ON CONFLICT(user_id) DO NOTHING RETURNING version
        `).bind(user.id, payload, updatedAt).first()
      : await env.DB.prepare(`
          UPDATE recite_progress SET payload = ?, version = version + 1, updated_at = ?
          WHERE user_id = ? AND version = ? RETURNING version
        `).bind(payload, updatedAt, user.id, data.expectedVersion).first();
    if (row) return json({ version: row.version, updatedAt });
    return json({ error: 'Progress changed on another device.', ...await savedProgress(env, user.id) }, 409);
  }
  if (request.method === 'POST' && path === '/api/account/logout') {
    await env.DB.prepare('DELETE FROM recite_sessions WHERE token_hash = ?').bind(await hash(account.token)).run();
    return json({}, 200, { 'Set-Cookie': cookie(SESSION_COOKIE, '', 0) });
  }
  if (request.method === 'DELETE' && ['/api/account', '/api/account/account'].includes(path)) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM recite_progress WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM recite_sessions WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM recite_users WHERE id = ?').bind(user.id),
    ]);
    return json({}, 200, { 'Set-Cookie': cookie(SESSION_COOKIE, '', 0) });
  }
  return json({ error: 'Not found.' }, 404);
}

export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch {
      // Do not log credentials, cookies, provider responses, or user data.
      return json({ error: 'Account service unavailable. Your browser copy is still available.' }, 503);
    }
  },
  async scheduled(event, env) {
    if (!env.DB) return;
    await env.DB.batch([
      env.DB.prepare('DELETE FROM recite_oauth_states WHERE expires_at < ?').bind(Date.now()),
      env.DB.prepare('DELETE FROM recite_sessions WHERE expires_at < ?').bind(Date.now()),
    ]);
  },
};
