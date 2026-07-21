import { create } from "zustand";
import { mockSubscriptions } from "../data/mockSubscriptions";
import { ResolutionAction, Subscription } from "../types/subscription";

type SubscriptionState = {
  subscriptions: Subscription[];
  remoteSubscriptions: Subscription[];
  selectedSubscriptionId: string | null;
  lastSaving: { merchant: string; annualAmount: number } | null;
  selectSubscription: (id: string | null) => void;
  resolveSubscription: (id: string, action: ResolutionAction) => void;
  addSubscription: (subscription: Subscription) => void;
  updateSubscription: (id: string, patch: Partial<Subscription>) => void;
  upsertRemoteSubscription: (subscription: Subscription) => void;
  removeRemoteSubscription: (id: string) => void;
  totalMonthly: () => number;
  totalAnnual: () => number;
  needsAttentionCount: () => number;
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscriptions: mockSubscriptions,
  remoteSubscriptions: [],
  selectedSubscriptionId: null,
  lastSaving: { merchant: "FitBox Annual", annualAmount: 143.88 },
  selectSubscription: (id) => set({ selectedSubscriptionId: id }),
  resolveSubscription: (id, action) =>
    set((state) => {
      const subs = state.subscriptions.map((s): Subscription => {
        if (s.id !== id) return s;
        switch (action) {
          case "cancel":
            return { ...s, status: "cancelled", mood: "resolved", healthScore: 100 };
          case "renew":
          case "acceptPrice":
            return { ...s, status: "renewed", mood: "resolved", healthScore: 100 };
          case "snooze":
            return {
              ...s,
              status: "snoozed",
              mood: s.mood === "critical" ? "sick" : "concerned",
              healthScore: Math.min(s.healthScore + 20, 60),
              daysRemaining: s.daysRemaining + 3,
              snoozeCount: (s.snoozeCount ?? 0) + 1,
            };
          case "dispute":
            return { ...s, status: "snoozed", mood: "concerned" };
        }
      });
      const target = state.subscriptions.find((s) => s.id === id);
      const lastSaving =
        action === "cancel" && target
          ? { merchant: target.merchant, annualAmount: target.annualCost }
          : state.lastSaving;
      return { subscriptions: subs, lastSaving };
    }),
  addSubscription: (subscription) =>
    set((state) => ({ subscriptions: [...state.subscriptions, subscription] })),
  updateSubscription: (id, patch) =>
    set((state) => ({
      subscriptions: state.subscriptions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),
  upsertRemoteSubscription: (subscription) =>
    set((state) => ({
      remoteSubscriptions: state.remoteSubscriptions.some((item) => item.id === subscription.id)
        ? state.remoteSubscriptions.map((item) => item.id === subscription.id ? subscription : item)
        : [...state.remoteSubscriptions, subscription],
    })),
  removeRemoteSubscription: (id) =>
    set((state) => ({
      remoteSubscriptions: state.remoteSubscriptions.filter((item) => item.id !== id),
    })),
  totalMonthly: () =>
    get()
      .subscriptions.filter((s) => s.status !== "cancelled")
      .reduce((sum, s) => sum + (s.billingInterval === "yearly" ? s.price / 12 : s.price), 0),
  totalAnnual: () =>
    get()
      .subscriptions.filter((s) => s.status !== "cancelled")
      .reduce((sum, s) => sum + s.annualCost, 0),
  needsAttentionCount: () =>
    get().subscriptions.filter(
      (s) => s.status === "active" && (s.mood === "sick" || s.mood === "critical" || s.mood === "concerned")
    ).length,
}));
