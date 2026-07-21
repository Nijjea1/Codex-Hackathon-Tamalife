import { Subscription } from "../types/subscription";

export type PortfolioStats = {
  active: Subscription[];
  count: number;
  /** Average health across active items, 0-100. */
  health: number;
  thriving: number;
  needsAttention: number;
  priceHikes: Subscription[];
  cancelled: Subscription[];
  /** Annualised amount no longer being paid, from cancelled items. */
  savedPerYear: number;
  level: number;
  levelLabel: string;
};

/** Everything the dashboard/profile HUD needs, derived from real data only. */
export function portfolioStats(subscriptions: Subscription[]): PortfolioStats {
  const active = subscriptions.filter((s) => s.status !== "cancelled");
  const health = active.length
    ? Math.round(active.reduce((sum, s) => sum + s.healthScore, 0) / active.length)
    : 100;
  const thriving = active.filter((s) => s.mood === "happy" || s.mood === "healthy").length;
  const needsAttention = active.filter((s) => s.needsAttention).length;
  const priceHikes = active.filter((s) => s.priceHikeDetected);
  const cancelled = subscriptions.filter((s) => s.status === "cancelled");
  const savedPerYear = cancelled.reduce((sum, s) => sum + s.annualCost, 0);
  // Level rewards a bigger, healthier garden — derived, no new backend state.
  const level = 1 + Math.floor(active.length / 2) + (health >= 80 ? 1 : 0);
  const levelLabel = health >= 85 ? "Master Keeper" : health >= 60 ? "Keeper" : "Sprout";
  return {
    active,
    count: active.length,
    health,
    thriving,
    needsAttention,
    priceHikes,
    cancelled,
    savedPerYear,
    level,
    levelLabel,
  };
}

/** Real, data-driven savings tips (no canned strings). */
export function savingsTips(subscriptions: Subscription[]): string[] {
  const active = subscriptions.filter((s) => s.status !== "cancelled");
  const tips: string[] = [];

  // Duplicate categories.
  const byCategory = active.reduce<Record<string, Subscription[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});
  for (const [category, items] of Object.entries(byCategory)) {
    if (items.length >= 2) {
      tips.push(`You have ${items.length} ${category.toLowerCase()} subscriptions. Do you use them all?`);
    }
  }

  // Unresolved price increases.
  for (const s of active.filter((s) => s.priceHikeDetected)) {
    tips.push(`${s.merchant} went up in price. Worth reviewing before it renews.`);
  }

  // Trials ending soon.
  for (const s of active.filter((s) => s.billingInterval === "trial" && s.daysRemaining <= 7)) {
    tips.push(`${s.merchant}'s free trial ends in ${Math.max(s.daysRemaining, 0)} day${s.daysRemaining === 1 ? "" : "s"}.`);
  }

  // Priciest monthly item.
  const priciest = [...active].sort((a, b) => (b.monthlyCost ?? b.price) - (a.monthlyCost ?? a.price))[0];
  if (priciest) {
    tips.push(`${priciest.displayName} is your most expensive at ${formatShort(priciest.monthlyCost ?? priciest.price)}/mo.`);
  }

  return tips.slice(0, 4);
}

function formatShort(value: number): string {
  return `$${value.toFixed(2)}`;
}
