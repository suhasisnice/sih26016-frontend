/* The only place in the app that calls fetch.
   Base URL, bearer token, query building, and error unwrapping live here so
   that when the backend changes a shape, exactly one file changes. */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TOKEN_KEY = 'bhoomimitra.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private windows and blocked site data both throw here. An anonymous
    // session is a worse experience, not a broken one.
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore — the in-memory AuthContext still holds it for this tab */
  }
}

/* The backend returns two different error shapes:
     {"detail": "Incorrect username or password"}          — plain string
     {"detail": [{"loc": [...], "msg": "..."}]}            — FastAPI validation
   CLAUDE.md 6 promises a third, {"detail": {"code", "message"}}, which the
   API does not currently send. All three are normalised to one Error with
   .code and .message so the app writes one error handler, not nine. */
export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

function unwrapError(status, body) {
  const detail = body && body.detail;

  if (typeof detail === 'string') {
    return new ApiError(detail, codeFromStatus(status), status);
  }
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && detail.message) {
    return new ApiError(detail.message, detail.code || codeFromStatus(status), status);
  }
  if (Array.isArray(detail)) {
    // FastAPI validation errors: surface the first field message, which is
    // the only one a person can act on without reading the array.
    const first = detail[0];
    const field = first && Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : null;
    const msg = first && first.msg ? first.msg : 'That request was not valid.';
    return new ApiError(field ? `${field}: ${msg}` : msg, 'validation_error', status);
  }
  return new ApiError(messageFromStatus(status), codeFromStatus(status), status);
}

function codeFromStatus(status) {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status >= 500) return 'server_error';
  return 'request_failed';
}

function messageFromStatus(status) {
  if (status === 401) return 'Your session has ended. Sign in again.';
  if (status === 403) return 'Your role does not have access to this.';
  if (status === 404) return 'That record could not be found.';
  if (status >= 500) return 'The server could not complete that request.';
  return 'That request could not be completed.';
}

/* Drops null, undefined and '' so callers can pass a filter object straight
   through without checking each key. `false` and `0` are kept — they are
   real filter values. */
export function qs(params) {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function request(path, { method = 'GET', body, form, signal, raw, headers: extraHeaders } = {}) {
  const headers = { ...extraHeaders };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    // /auth/login is OAuth2 password flow — form-encoded, not JSON.
    payload = new URLSearchParams(form).toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (body instanceof FormData) {
    payload = body; // multipart: let the browser set the boundary
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(
      'Could not reach the server. Check that the API is running.',
      'network_error',
      0,
    );
  }

  if (raw) {
    if (!res.ok) throw unwrapError(res.status, await safeJson(res));
    return res;
  }

  if (res.status === 204) return null;

  const data = await safeJson(res);
  if (!res.ok) throw unwrapError(res.status, data);
  return data;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  postForm: (path, form, opts) => request(path, { ...opts, method: 'POST', form }),
  raw: (path, opts) => request(path, { ...opts, raw: true }),
  base: BASE,
};
