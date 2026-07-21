import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/expo";
import { useDemoModeStore } from "../store/useDemoModeStore";
import {
  AlternativesResponseDto,
  DealsResponseDto,
  MatchConfirmationRequestDto,
  PriceHistoryResponseDto,
  PriceIntelligenceSummaryDto,
  RecommendationFeedbackRequestDto,
  SubscriptionIntelligenceDto,
} from "../types/priceIntelligence";
import { ApiError, createIdempotencyKey, useApiClient } from "./api";

export type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: ApiError | null;
  refresh: () => Promise<void>;
  update: (updater: (current: T) => T) => void;
};

function useResource<T>(loader: (signal: AbortSignal) => Promise<T>, demoData: T): ResourceState<T> {
  const demo = useDemoModeStore((state) => state.active);
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const authKey = `${userId ?? ""}:${sessionId ?? ""}`;
  const [data, setData] = useState<T | null>(demo ? demoData : null);
  const [loading, setLoading] = useState(!demo);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const sequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    activeRequest.current?.abort();
    const request = ++sequence.current;
    if (demo) {
      setData(demoData);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }
    if (!isLoaded) {
      setLoading(true);
      return;
    }
    if (!isSignedIn) {
      setData(null);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    activeRequest.current = controller;
    if (data === null) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const next = await loader(controller.signal);
      if (sequence.current === request) setData(next);
    } catch (cause) {
      if (
        sequence.current === request &&
        !(cause instanceof ApiError && cause.code === "request_cancelled")
      ) {
        setError(cause instanceof ApiError ? cause : new ApiError("unknown_error", "Price intelligence is temporarily unavailable.", 0));
      }
    } finally {
      if (sequence.current === request) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [data, demo, demoData, isLoaded, isSignedIn, loader]);

  useEffect(() => {
    if (!demo) setData(null);
    void refresh();
    return () => {
      sequence.current += 1;
      activeRequest.current?.abort();
    };
  }, [loader, demo, authKey, isLoaded, isSignedIn]); // Deliberately excludes data-sensitive refresh identity.

  const update = useCallback((updater: (current: T) => T) => {
    setData((current) => current === null ? current : updater(current));
  }, []);

  return { data, loading, refreshing, error, refresh, update };
}

const emptySummary: PriceIntelligenceSummaryDto = {
  subscription_count: 0,
  matched_count: 0,
  unmatched_count: 0,
  price_change_count: 0,
  active_deal_count: 0,
  recommendation_count: 0,
  estimated_monthly_savings: "0.00",
  estimated_annual_savings: "0.00",
  generated_at: new Date(0).toISOString(),
};

export function usePriceIntelligenceSummary() {
  const api = useApiClient();
  const loader = useCallback((signal: AbortSignal) => api.priceIntelligenceSummary(signal), [api]);
  return useResource(loader, emptySummary);
}

export function useSubscriptionPriceIntelligence(subscriptionId: string) {
  const api = useApiClient();
  const { userId, sessionId } = useAuth();
  const sessionKey = `${userId ?? ""}:${sessionId ?? ""}`;
  const sessionKeyRef = useRef(sessionKey);
  sessionKeyRef.current = sessionKey;
  const mutationMounted = useRef(true);
  const emptyIntelligence: SubscriptionIntelligenceDto = {
    subscription_id: subscriptionId,
    match: null,
    latest_price: null,
    recommendations: [],
    generated_at: new Date(0).toISOString(),
  };
  const intelligenceLoader = useCallback(
    (signal: AbortSignal) => api.subscriptionIntelligence(subscriptionId, signal), [api, subscriptionId],
  );
  const historyLoader = useCallback((signal: AbortSignal) => api.priceHistory(subscriptionId, signal), [api, subscriptionId]);
  const dealsLoader = useCallback((signal: AbortSignal) => api.subscriptionDeals(subscriptionId, signal), [api, subscriptionId]);
  const alternativesLoader = useCallback(
    (signal: AbortSignal) => api.subscriptionAlternatives(subscriptionId, signal), [api, subscriptionId],
  );
  const intelligence = useResource(intelligenceLoader, emptyIntelligence);
  const history = useResource<PriceHistoryResponseDto>(historyLoader, { subscription_id: subscriptionId, items: [] });
  const deals = useResource<DealsResponseDto>(dealsLoader, { subscription_id: subscriptionId, items: [] });
  const alternatives = useResource<AlternativesResponseDto>(alternativesLoader, { subscription_id: subscriptionId, items: [] });
  const [matchPendingKey, setMatchPendingKey] = useState<string | null>(null);
  const [feedbackPending, setFeedbackPending] = useState<string | null>(null);
  const pendingMutations = useRef(new Set<string>());
  const mutationControllers = useRef(new Map<string, AbortController>());

  useEffect(() => {
    mutationMounted.current = true;
    return () => { mutationMounted.current = false; };
  }, []);

  useEffect(() => () => {
    mutationControllers.current.forEach((controller) => controller.abort());
    mutationControllers.current.clear();
    pendingMutations.current.clear();
  }, [sessionKey]);

  const confirmMatch = useCallback(async (body: MatchConfirmationRequestDto) => {
    const pendingKey = `match:${body.match_id}`;
    if (pendingMutations.current.has(pendingKey)) {
      throw new ApiError("mutation_pending", "This match confirmation is already being saved.", 0);
    }
    const controller = new AbortController();
    const startedSession = sessionKeyRef.current;
    pendingMutations.current.add(pendingKey);
    mutationControllers.current.set(pendingKey, controller);
    setMatchPendingKey(pendingKey);
    try {
      const result = await api.confirmSubscriptionMatch(
        subscriptionId,
        body,
        createIdempotencyKey(pendingKey),
        controller.signal,
      );
      if (startedSession !== sessionKeyRef.current) {
        throw new ApiError("request_cancelled", "The signed-in session changed.", 0);
      }
      intelligence.update((current) => ({ ...current, match: result.match }));
      await Promise.all([history.refresh(), deals.refresh(), alternatives.refresh()]);
      return result.match;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) await intelligence.refresh();
      throw error;
    } finally {
      pendingMutations.current.delete(pendingKey);
      mutationControllers.current.delete(pendingKey);
      if (mutationMounted.current) {
        setMatchPendingKey((current) => current === pendingKey ? null : current);
      }
    }
  }, [alternatives, api, deals, history, intelligence, subscriptionId]);

  const submitFeedback = useCallback(async (
    recommendationId: string,
    body: RecommendationFeedbackRequestDto,
  ) => {
    const pendingKey = `feedback:${recommendationId}`;
    if (pendingMutations.current.has(pendingKey)) {
      throw new ApiError("mutation_pending", "This feedback is already being saved.", 0);
    }
    const controller = new AbortController();
    const startedSession = sessionKeyRef.current;
    pendingMutations.current.add(pendingKey);
    mutationControllers.current.set(pendingKey, controller);
    setFeedbackPending(recommendationId);
    try {
      const updated = await api.recommendationFeedback(
        recommendationId,
        body,
        createIdempotencyKey(pendingKey),
        controller.signal,
      );
      if (startedSession !== sessionKeyRef.current) {
        throw new ApiError("request_cancelled", "The signed-in session changed.", 0);
      }
      intelligence.update((current) => ({
        ...current,
        recommendations: current.recommendations.map((item) => item.id === updated.id ? updated : item),
      }));
      return updated;
    } finally {
      pendingMutations.current.delete(pendingKey);
      mutationControllers.current.delete(pendingKey);
      if (mutationMounted.current) {
        setFeedbackPending((current) => current === recommendationId ? null : current);
      }
    }
  }, [api, intelligence]);

  return {
    intelligence,
    history,
    deals,
    alternatives,
    matchPending: matchPendingKey !== null,
    matchPendingKey,
    feedbackPending,
    confirmMatch,
    submitFeedback,
  };
}

export type DashboardIntelligence = {
  summary: PriceIntelligenceSummaryDto;
  intelligence: SubscriptionIntelligenceDto[];
  deals: DealsResponseDto[];
};

export function usePriceDashboardItems(subscriptionIds: string[]) {
  const api = useApiClient();
  const key = subscriptionIds.join(",");
  const loader = useCallback(async (signal: AbortSignal): Promise<DashboardIntelligence> => {
    const ids = new Set(key ? key.split(",") : []);
    const payload = await api.priceIntelligenceDashboard(signal);
    const intelligence = payload.subscriptions
      .filter((item) => ids.has(item.subscription_id))
      .map((item): SubscriptionIntelligenceDto => ({
        subscription_id: item.subscription_id,
        match: item.match,
        latest_price: item.latest_price,
        recommendations: item.recommendations,
        generated_at: payload.generated_at,
      }));
    const confirmed = intelligence.filter((item) => item.match?.status === "confirmed");
    const deals = await Promise.all(confirmed.map((item) => api.subscriptionDeals(item.subscription_id, signal)));
    return { summary: payload.summary, intelligence, deals };
  }, [api, key]);
  return useResource<DashboardIntelligence>(loader, { summary: emptySummary, intelligence: [], deals: [] });
}
