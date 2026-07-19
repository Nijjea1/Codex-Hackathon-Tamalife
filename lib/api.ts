/**
 * Thin client for the Tamalife backend. The whole point of this file is the
 * auth handshake: attach the Clerk session token as a Bearer header so the
 * backend can verify who's calling.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export type MeResponse = {
  user_id: string;
  clerk_user_id: string;
  session_id: string | null;
  claims: Record<string, unknown>;
};

async function request<T>(path: string, token: string | null): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const body = await res.json();
      code = body?.error?.code ?? code;
    } catch {
      // response wasn't JSON; keep the status-based code
    }
    throw new Error(code);
  }
  return (await res.json()) as T;
}

/** Calls the protected /v1/me endpoint with the current Clerk token. */
export function fetchMe(token: string | null): Promise<MeResponse> {
  return request<MeResponse>("/v1/me", token);
}

export const apiBaseUrl = BASE_URL;
