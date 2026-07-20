import { useCallback, useEffect, useState } from "react";
import { useDemoModeStore } from "../store/useDemoModeStore";
import { useSubscriptionStore } from "../store/useSubscriptionStore";
import { Subscription } from "../types/subscription";
import { ApiError, createIdempotencyKey, useApiClient } from "./api";
import { mapSubscription } from "./mappers";

export function useSubscriptionData(subscriptionId?: string) {
  const demo = useDemoModeStore((s) => s.active);
  const demoSubscriptions = useSubscriptionStore((s) => s.subscriptions);
  const demoResolve = useSubscriptionStore((s) => s.resolveSubscription);
  const api = useApiClient();
  const [remote, setRemote] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    setError(null);
    try {
      if (subscriptionId) {
        setRemote([mapSubscription(await api.getSubscription(subscriptionId))]);
      } else {
        const items = [];
        let cursor: string | undefined;
        const cursors = new Set<string>();
        let pages = 0;
        do {
          const response = await api.listSubscriptions(cursor);
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
        setRemote(items.map(mapSubscription));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to load subscriptions.");
    } finally {
      setLoading(false);
    }
  }, [api, demo, subscriptionId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const resolve = useCallback(async (id: string, action: "renew" | "cancel" | "dispute" | "keep" | "snooze") => {
    if (demo) {
      demoResolve(id, action === "keep" ? "acceptPrice" : action);
      return;
    }
    if (action === "snooze") throw new ApiError("unsupported_action", "Snooze is not available yet.", 400);
    const updated = mapSubscription(await api.resolveSubscription(id, action, createIdempotencyKey(`resolve:${id}`)));
    setRemote((items) => items.map((item) => item.id === id ? updated : item));
  }, [api, demo, demoResolve]);

  return { subscriptions: demo ? demoSubscriptions : remote, loading, error, refresh, resolve, demo };
}
