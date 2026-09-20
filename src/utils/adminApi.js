import { API_URL } from "./apiUrl";

/**
 * Call the Express API with the signed-in user's Firebase ID token.
 * `getToken` comes from useAuth(). Returns the raw Response.
 */
export async function adminFetch(getToken, path, options = {}) {
  const token = await getToken();
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * JSON convenience wrapper: sends `body` as JSON, returns parsed JSON, and
 * throws an Error carrying the server's message on any non-2xx response.
 */
export async function adminJson(getToken, path, { method = "GET", body } = {}) {
  const res = await adminFetch(getToken, path, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** Build a query string, skipping empty values. */
export function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}
