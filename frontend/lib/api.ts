import { useAuth } from "@clerk/expo";
import * as Crypto from "expo-crypto";
import { useMemo, useRef } from "react";
import { Platform } from "react-native";
import { apiBaseUrl } from "./config";
import {
  ConfirmParseResponseDto,
  DashboardSummaryDto,
  ExtractedReceiptDto,
  MeDto,
  NotificationPreferencesDto,
  ParseResponseDto,
  SubscriptionDto,
  SubscriptionListDto,
  SubscriptionWriteDto,
} from "../types/api";
import {
  AlternativesResponseDto,
  DealsResponseDto,
  MatchConfirmationRequestDto,
  MatchConfirmationResponseDto,
  PriceHistoryResponseDto,
  PriceIntelligenceSummaryDto,
  RecommendationDto,
  RecommendationFeedbackRequestDto,
  SubscriptionIntelligenceDto,
} from "../types/priceIntelligence";

const DEFAULT_TIMEOUT_MS = 15_000;
const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504]);
const MIN_RETRY_DELAY_MS = 100;
const MAX_RETRY_DELAY_MS = 10_000;

export type MeResponse = MeDto;
export type ApiRequestOptions = RequestInit & {
  authenticated?: boolean;
  timeoutMs?: number;
  retries?: number;
  idempotencyKey?: string;
};

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly detail?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function wait(ms: number, signal?: AbortSignal | null): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const finish = (completed: boolean) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(completed);
    };
    const onAbort = () => finish(false);
    const timer = setTimeout(() => finish(true), ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function retryDelay(response: Response | null, attempt: number): number {
  const header = response?.headers.get("Retry-After")?.trim();
  let delay = 250 * 2 ** attempt;
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      delay = seconds * 1000;
    } else {
      const date = Date.parse(header);
      if (Number.isFinite(date)) delay = Math.max(0, date - Date.now());
    }
  }
  const clamped = Math.min(MAX_RETRY_DELAY_MS, Math.max(MIN_RETRY_DELAY_MS, delay));
  return Math.round(
    Math.min(MAX_RETRY_DELAY_MS, Math.max(MIN_RETRY_DELAY_MS, clamped * (0.85 + Math.random() * 0.3))),
  );
}

async function request<T>(
  path: string,
  getToken: () => Promise<string | null>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    authenticated = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries,
    idempotencyKey,
    ...requestInit
  } = options;
  const method = (requestInit.method ?? "GET").toUpperCase();
  const safe = method === "GET" || method === "HEAD";
  const maxRetries = safe ? (retries ?? 2) : 0;
  const requestId = Crypto.randomUUID();
  const callerSignal = requestInit.signal;

  for (let attempt = 0; ; attempt += 1) {
    const headers = new Headers(requestInit.headers);
    headers.set("X-Request-ID", requestId);
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
    if (authenticated) {
      const token = await getToken();
      if (!token) throw new ApiError("not_authenticated", "Please sign in and try again.", 401);
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (requestInit.body && !headers.has("Content-Type") && !(requestInit.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    if (callerSignal?.aborted) controller.abort();
    else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetch(`${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
        ...requestInit,
        headers,
        signal: controller.signal,
      });
      const responseRequestId = response.headers.get("X-Request-ID") ?? requestId;
      if (!response.ok) {
        if (safe && attempt < maxRetries && RETRYABLE_STATUS.has(response.status)) {
          if (!(await wait(retryDelay(response, attempt), callerSignal))) {
            throw new ApiError("request_cancelled", "The request was cancelled.", 0, undefined, requestId);
          }
          continue;
        }
        let error = { code: `http_${response.status}`, message: `Request failed (${response.status}).`, detail: undefined as unknown };
        try {
          const body = await response.json();
          error = {
            code: body?.error?.code ?? error.code,
            message: body?.error?.message ?? error.message,
            detail: body?.error?.detail,
          };
        } catch {
          // Non-JSON upstream errors retain the safe status message.
        }
        throw new ApiError(error.code, error.message, response.status, error.detail, responseRequestId);
      }
      if (response.status === 204) return undefined as T;
      try {
        return (await response.json()) as T;
      } catch {
        throw new ApiError(
          "invalid_response",
          "The server returned an invalid response.",
          response.status,
          undefined,
          responseRequestId,
        );
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (callerSignal?.aborted) {
        throw new ApiError("request_cancelled", "The request was cancelled.", 0, undefined, requestId);
      }
      if (safe && attempt < maxRetries) {
        if (!(await wait(retryDelay(null, attempt), callerSignal))) {
          throw new ApiError("request_cancelled", "The request was cancelled.", 0, undefined, requestId);
        }
        continue;
      }
      throw new ApiError(
        timedOut ? "request_timeout" : "network_error",
        timedOut ? "The request timed out. Please try again." : "Something went wrong. Please try again.",
        0,
        undefined,
        requestId,
      );
    } finally {
      clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }
  }
}

export function createIdempotencyKey(scope: string): string {
  return `${scope}:${Crypto.randomUUID()}`;
}

export function useApiClient() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  return useMemo(() => {
    const raw = <T,>(path: string, options?: ApiRequestOptions) =>
      request<T>(path, () => getTokenRef.current(), options);
    return {
      request: raw,
      me: () => raw<MeDto>("/v1/me"),
      exportMyData: () => raw<Record<string, unknown>>("/v1/me/export"),
      listSubscriptions: (cursor?: string, signal?: AbortSignal) =>
        raw<SubscriptionListDto>(`/v1/subscriptions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { signal }),
      getSubscription: (id: string, signal?: AbortSignal) =>
        raw<SubscriptionDto>(`/v1/subscriptions/${encodeURIComponent(id)}`, { signal }),
      createSubscription: (body: SubscriptionWriteDto) =>
        raw<SubscriptionDto>("/v1/subscriptions", { method: "POST", body: JSON.stringify(body) }),
      updateSubscription: (id: string, body: Partial<SubscriptionWriteDto>) =>
        raw<SubscriptionDto>(`/v1/subscriptions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
      resolveSubscription: (id: string, action: "renew" | "cancel" | "dispute" | "keep", idempotencyKey: string, signal?: AbortSignal) =>
        raw<SubscriptionDto>(`/v1/subscriptions/${encodeURIComponent(id)}/resolve`, {
          method: "PATCH",
          idempotencyKey,
          signal,
          body: JSON.stringify({ action, idempotency_key: idempotencyKey }),
        }),
      archiveSubscription: (id: string) =>
        raw<void>(`/v1/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" }),
      dashboardSummary: () => raw<DashboardSummaryDto>("/v1/dashboard/summary"),
      priceIntelligenceSummary: (signal?: AbortSignal) =>
        raw<PriceIntelligenceSummaryDto>("/v1/price-intelligence/summary", { signal }),
      subscriptionIntelligence: (id: string, signal?: AbortSignal) =>
        raw<SubscriptionIntelligenceDto>(`/v1/subscriptions/${encodeURIComponent(id)}/intelligence`, { signal }),
      priceHistory: (id: string, signal?: AbortSignal) =>
        raw<PriceHistoryResponseDto>(`/v1/subscriptions/${encodeURIComponent(id)}/price-history`, { signal }),
      subscriptionDeals: (id: string, signal?: AbortSignal) =>
        raw<DealsResponseDto>(`/v1/subscriptions/${encodeURIComponent(id)}/deals`, { signal }),
      subscriptionAlternatives: (id: string, signal?: AbortSignal) =>
        raw<AlternativesResponseDto>(`/v1/subscriptions/${encodeURIComponent(id)}/alternatives`, { signal }),
      confirmSubscriptionMatch: (id: string, body: MatchConfirmationRequestDto, idempotencyKey: string, signal?: AbortSignal) =>
        raw<MatchConfirmationResponseDto>(`/v1/subscriptions/${encodeURIComponent(id)}/match-confirmation`, {
          method: "POST",
          idempotencyKey,
          signal,
          body: JSON.stringify(body),
        }),
      recommendationFeedback: (id: string, body: RecommendationFeedbackRequestDto, idempotencyKey: string, signal?: AbortSignal) =>
        raw<RecommendationDto>(`/v1/recommendations/${encodeURIComponent(id)}/feedback`, {
          method: "POST",
          idempotencyKey,
          signal,
          body: JSON.stringify(body),
        }),
      notificationPreferences: () => raw<NotificationPreferencesDto>("/v1/notification-preferences"),
      updateNotificationPreferences: (body: Partial<NotificationPreferencesDto>) =>
        raw<NotificationPreferencesDto>("/v1/notification-preferences", { method: "PATCH", body: JSON.stringify(body) }),
      parseText: (text: string) => {
        const form = new FormData();
        form.append("text", text);
        return raw<ParseResponseDto>("/v1/parse", { method: "POST", body: form, timeoutMs: 45_000 });
      },
      parseImage: async (uri: string, name: string, type: string) => {
        const form = new FormData();
        if (Platform.OS === "web") {
          // On web the {uri,name,type} shape is not a real file, so fetch the
          // blob and attach it as an actual File instead.
          const blob = await (await fetch(uri)).blob();
          form.append("image", new File([blob], name, { type: type || blob.type }));
        } else {
          form.append("image", { uri, name, type } as unknown as Blob);
        }
        return raw<ParseResponseDto>("/v1/parse", { method: "POST", body: form, timeoutMs: 45_000 });
      },
      getParse: (id: string) => raw<ParseResponseDto>(`/v1/parse/${encodeURIComponent(id)}`),
      confirmParse: (id: string, extracted: ExtractedReceiptDto, creatureName: string, creatureSpecies: string) =>
        raw<ConfirmParseResponseDto>(`/v1/parse/${encodeURIComponent(id)}/confirm`, {
          method: "POST",
          body: JSON.stringify({ extracted, creature_name: creatureName, creature_species: creatureSpecies }),
        }),
    };
  }, []);
}

export { apiBaseUrl };
