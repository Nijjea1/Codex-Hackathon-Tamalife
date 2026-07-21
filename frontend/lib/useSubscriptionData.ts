import { useCallback, useEffect, useRef, useState } from "react";
import { useDemoModeStore } from "../store/useDemoModeStore";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { Subscription } from "../types/subscription";
import { ApiError, createIdempotencyKey, useApiClient } from "./api";
import { mapSubscription } from "./mappers";
import { useForegroundRefresh } from "./useForegroundRefresh";

export function useSubscriptionData(subscriptionId?: string) {
  const demo = useDemoModeStore((s) => s.active);
  const demoSubscriptions = useSubscriptionStore((s) => s.subscriptions);
  const demoResolve = useSubscriptionStore((s) => s.resolveSubscription);
  const optimisticSubscriptions = useSubscriptionStore((s) => s.remoteSubscriptions);
  const api = useApiClient();
  const [remote, setRemote] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
    };
  }, []);

  const refresh = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const request = ++sequence.current;
    if (demo) {
      if (mounted.current) {
        setLoading(false);
        setError(null);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (subscriptionId) {
        const item = mapSubscription(await api.getSubscription(subscriptionId, controller.signal));
        if (mounted.current && sequence.current === request) setRemote([item]);
      } else {
        const items = [];
        let cursor: string | undefined;
        const cursors = new Set<string>();
        let pages = 0;
        do {
          const response = await api.listSubscriptions(cursor, controller.signal);
          items.push(...response.items);
          cursor = response.next_cursor ?? undefined;
          pages += 1;
          if (cursor && cursors.has(cursor)) {
            throw new ApiError("invalid_pagination", "The server returned a repeated page cursor.", 0);
          }
          if (cursor) cursors.add(cursor);
          if (pages >= 100 && cursor) {
            throw new ApiError("pagination_limit", "Too many subscription pages were returned.", 0);
          }
        } while (cursor);
        if (mounted.current && sequence.current === request) setRemote(items.map(mapSubscription));
      }
    } catch (e) {
      if (
        mounted.current &&
        sequence.current === request &&
        !(e instanceof ApiError && e.code === "request_cancelled")
      ) {
        setError(e instanceof ApiError ? e.message : "Unable to load subscriptions.");
      }
    } finally {
      if (mounted.current && sequence.current === request) setLoading(false);
    }
  }, [api, demo, subscriptionId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useForegroundRefresh(refresh, !demo);

  const resolve = useCallback(async (id: string, action: "renew" | "cancel" | "dispute" | "keep" | "snooze") => {
    if (demo) {
      demoResolve(id, action === "keep" ? "acceptPrice" : action);
      return;
    }
    if (action === "snooze") throw new ApiError("unsupported_action", "Snooze is not available yet.", 400);
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const request = ++sequence.current;
    const updated = mapSubscription(await api.resolveSubscription(
      id,
      action,
      createIdempotencyKey(`resolve:${id}`),
      controller.signal,
    ));
    if (mounted.current && sequence.current === request) {
      setRemote((items) => items.map((item) => item.id === id ? updated : item));
    }
  }, [api, demo, demoResolve]);

  const subscriptions = demo
    ? demoSubscriptions
    : [...remote, ...optimisticSubscriptions.filter((item) => !remote.some((remoteItem) => remoteItem.id === item.id))];

  return { subscriptions, loading, error, refresh, resolve, demo };
}
