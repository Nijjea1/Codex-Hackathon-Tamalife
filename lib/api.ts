import { useAuth } from "@clerk/expo";
import { useMemo } from "react";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export type MeResponse = {
  user_id: string;
  clerk_user_id: string;
  session_id: string | null;
  claims: Record<string, unknown>;
};

export type ApiRequestOptions = RequestInit & {
  authenticated?: boolean;
};

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}

async function request<T>(
  path: string,
  getToken: () => Promise<string | null>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { authenticated = true, ...requestInit } = options;
  const headers = new Headers(requestInit.headers);
  if (authenticated) {
    const token = await getToken();
    if (!token) throw new ApiError("not_authenticated", 401);
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (requestInit.body && !headers.has("Content-Type") && !(requestInit.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...requestInit, headers });
  if (!response.ok) {
    let code = `http_${response.status}`;
    try {
      const body = await response.json();
      code = body?.error?.code ?? code;
    } catch {
      // Keep the status-derived code when the response has no JSON envelope.
    }
    throw new ApiError(code, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function useApiClient() {
  const { getToken } = useAuth();
  return useMemo(
    () => ({
      request: <T>(path: string, options?: ApiRequestOptions) =>
        request<T>(path, getToken, options),
    }),
    [getToken],
  );
}

export const apiBaseUrl = BASE_URL;
