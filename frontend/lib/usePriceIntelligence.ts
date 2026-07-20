import { useCallback, useEffect, useRef, useState } from "react";
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

function useResource<T>(loader: () => Promise<T>, demoData: T): ResourceState<T> {
  const demo = useDemoModeStore((state) => state.active);
  const [data, setData] = useState<T | null>(demo ? demoData : null);
  const [loading, setLoading] = useState(!demo);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    if (demo) {
      setData(demoData);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }
    if (data === null) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const next = await loader();
      if (sequence.current === request) setData(next);
    } catch (cause) {
      if (sequence.current === request) {
        setError(cause instanceof ApiError ? cause : new ApiError("unknown_error", "Something went wrong.", 0));
      }
    } finally {
      if (sequence.current === request) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [data, demo, demoData, loader]);

  useEffect(() => { void refresh(); }, [loader, demo]); // refresh is data-sensitive; loader/demo are the fetch triggers.

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
  const loader = useCallback(() => api.priceIntelligenceSummary(), [api]);
  return useResource(loader, emptySummary);
}

export function useSubscriptionPriceIntelligence(subscriptionId: string) {
  const api = useApiClient();
  const emptyIntelligence: SubscriptionIntelligenceDto = {
    subscription_id: subscriptionId,
    match: null,
    latest_price: null,
    recommendations: [],
    generated_at: new Date(0).toISOString(),
  };
  const intelligenceLoader = useCallback(
    () => api.subscriptionIntelligence(subscriptionId), [api, subscriptionId],
  );
  const historyLoader = useCallback(() => api.priceHistory(subscriptionId), [api, subscriptionId]);
  const dealsLoader = useCallback(() => api.subscriptionDeals(subscriptionId), [api, subscriptionId]);
  const alternativesLoader = useCallback(
    () => api.subscriptionAlternatives(subscriptionId), [api, subscriptionId],
  );
  const intelligence = useResource(intelligenceLoader, emptyIntelligence);
  const history = useResource<PriceHistoryResponseDto>(historyLoader, { subscription_id: subscriptionId, items: [] });
  const deals = useResource<DealsResponseDto>(dealsLoader, { subscription_id: subscriptionId, items: [] });
  const alternatives = useResource<AlternativesResponseDto>(alternativesLoader, { subscription_id: subscriptionId, items: [] });
  const [matchPending, setMatchPending] = useState(false);
  const [feedbackPending, setFeedbackPending] = useState<string | null>(null);

  const confirmMatch = useCallback(async (body: MatchConfirmationRequestDto) => {
    setMatchPending(true);
    try {
      const result = await api.confirmSubscriptionMatch(
        subscriptionId, body, createIdempotencyKey(`match:${body.match_id}`),
      );
      intelligence.update((current) => ({ ...current, match: result.match }));
      await Promise.all([history.refresh(), deals.refresh(), alternatives.refresh()]);
      return result.match;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) await intelligence.refresh();
      throw error;
    } finally {
      setMatchPending(false);
    }
  }, [alternatives, api, deals, history, intelligence, subscriptionId]);

  const submitFeedback = useCallback(async (
    recommendationId: string,
    body: RecommendationFeedbackRequestDto,
  ) => {
    setFeedbackPending(recommendationId);
    try {
      const updated = await api.recommendationFeedback(
        recommendationId, body, createIdempotencyKey(`feedback:${recommendationId}`),
      );
      intelligence.update((current) => ({
        ...current,
        recommendations: current.recommendations.map((item) => item.id === updated.id ? updated : item),
      }));
      return updated;
    } finally {
      setFeedbackPending(null);
    }
  }, [api, intelligence]);

  return { intelligence, history, deals, alternatives, matchPending, feedbackPending, confirmMatch, submitFeedback };
}

export type DashboardIntelligence = {
  intelligence: SubscriptionIntelligenceDto[];
  deals: DealsResponseDto[];
};

export function usePriceDashboardItems(subscriptionIds: string[]) {
  const api = useApiClient();
  const key = subscriptionIds.join(",");
  const loader = useCallback(async (): Promise<DashboardIntelligence> => {
    const ids = key ? key.split(",") : [];
    const intelligence = await Promise.all(ids.map((id) => api.subscriptionIntelligence(id)));
    const confirmed = intelligence.filter((item) => item.match?.status === "confirmed");
    const deals = await Promise.all(confirmed.map((item) => api.subscriptionDeals(item.subscription_id)));
    return { intelligence, deals };
  }, [api, key]);
  return useResource<DashboardIntelligence>(loader, { intelligence: [], deals: [] });
}
