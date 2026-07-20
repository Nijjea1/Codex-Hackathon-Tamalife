import { useAuth } from "@clerk/expo";
import * as Crypto from "expo-crypto";
import { useMemo, useRef } from "react";
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const maxRetries = retries ?? (safe ? 2 : 0);
  const requestId = Crypto.randomUUID();

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
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
        ...requestInit,
        headers,
        signal: controller.signal,
      });
      const responseRequestId = response.headers.get("X-Request-ID") ?? requestId;
      if (!response.ok) {
        if (safe && attempt < maxRetries && RETRYABLE_STATUS.has(response.status)) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          await wait(Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt);
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
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (safe && attempt < maxRetries) {
        await wait(250 * 2 ** attempt);
        continue;
      }
      const timedOut = error instanceof Error && error.name === "AbortError";
      throw new ApiError(
        timedOut ? "request_timeout" : "network_error",
        timedOut ? "The request timed out. Please try again." : "Unable to reach the server.",
        0,
        undefined,
        requestId,
      );
    } finally {
      clearTimeout(timeout);
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
      listSubscriptions: (cursor?: string) =>
        raw<SubscriptionListDto>(`/v1/subscriptions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
      getSubscription: (id: string) => raw<SubscriptionDto>(`/v1/subscriptions/${encodeURIComponent(id)}`),
      createSubscription: (body: SubscriptionWriteDto) =>
        raw<SubscriptionDto>("/v1/subscriptions", { method: "POST", body: JSON.stringify(body) }),
      updateSubscription: (id: string, body: Partial<SubscriptionWriteDto>) =>
        raw<SubscriptionDto>(`/v1/subscriptions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
      resolveSubscription: (id: string, action: "renew" | "cancel" | "dispute" | "keep", idempotencyKey: string) =>
        raw<SubscriptionDto>(`/v1/subscriptions/${encodeURIComponent(id)}/resolve`, {
          method: "PATCH",
          idempotencyKey,
          body: JSON.stringify({ action, idempotency_key: idempotencyKey }),
        }),
      archiveSubscription: (id: string) =>
        raw<void>(`/v1/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" }),
      dashboardSummary: () => raw<DashboardSummaryDto>("/v1/dashboard/summary"),
      priceIntelligenceSummary: () =>
        raw<PriceIntelligenceSummaryDto>("/v1/price-intelligence/summary"),
      subscriptionIntelligence: (id: string) =>
        raw<SubscriptionIntelligenceDto>(`/v1/subscriptions/${encodeURIComponent(id)}/intelligence`),
      priceHistory: (id: string) =>
        raw<PriceHistoryResponseDto>(`/v1/subscriptions/${encodeURIComponent(id)}/price-history`),
      subscriptionDeals: (id: string) =>
        raw<DealsResponseDto>(`/v1/subscriptions/${encodeURIComponent(id)}/deals`),
      subscriptionAlternatives: (id: string) =>
        raw<AlternativesResponseDto>(`/v1/subscriptions/${encodeURIComponent(id)}/alternatives`),
      confirmSubscriptionMatch: (id: string, body: MatchConfirmationRequestDto, idempotencyKey: string) =>
        raw<MatchConfirmationResponseDto>(`/v1/subscriptions/${encodeURIComponent(id)}/match-confirmation`, {
          method: "POST",
          idempotencyKey,
          body: JSON.stringify(body),
        }),
      recommendationFeedback: (id: string, body: RecommendationFeedbackRequestDto, idempotencyKey: string) =>
        raw<RecommendationDto>(`/v1/recommendations/${encodeURIComponent(id)}/feedback`, {
          method: "POST",
          idempotencyKey,
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
      parseImage: (uri: string, name: string, type: string) => {
        const form = new FormData();
        form.append("image", { uri, name, type } as unknown as Blob);
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
