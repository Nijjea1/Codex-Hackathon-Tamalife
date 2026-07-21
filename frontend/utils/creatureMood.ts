import { colors } from "../constants/theme";
import { CreatureMood, Subscription } from "../types/subscription";

export function moodFromDaysRemaining(days: number, status: Subscription["status"]): CreatureMood {
  if (status === "cancelled" || status === "renewed") return "resolved";
  if (days <= 0) return "critical";
  if (days <= 3) return "sick";
  if (days <= 12) return "concerned";
  if (days <= 25) return "healthy";
  return "happy";
}

export function healthFromDays(days: number): number {
  if (days <= 0) return 8;
  if (days <= 3) return 25;
  if (days <= 12) return 51;
  if (days <= 25) return 76;
  return 94;
}

export const moodMeta: Record<
  CreatureMood,
  { label: string; color: string; softColor: string; description: string; segments: number }
> = {
  happy: {
    label: "Happy",
    color: colors.success,
    softColor: colors.successSoft,
    description: "Thriving — nothing to worry about for a while.",
    segments: 5,
  },
  healthy: {
    label: "Healthy",
    color: colors.secondary,
    softColor: colors.secondarySoft,
    description: "Doing well. The renewal is still a way off.",
    segments: 4,
  },
  concerned: {
    label: "Concerned",
    color: colors.warning,
    softColor: colors.warningSoft,
    description: "Getting anxious — a renewal is approaching.",
    segments: 3,
  },
  sick: {
    label: "Sick",
    color: colors.danger,
    softColor: colors.dangerSoft,
    description: "Feeling unwell — this renews very soon and hasn't been reviewed.",
    segments: 2,
  },
  critical: {
    label: "Critical",
    color: colors.critical,
    softColor: colors.dangerSoft,
    description: "Needs attention right now — the deadline is today.",
    segments: 1,
  },
  reviving: {
    label: "Reviving",
    color: colors.primaryLight,
    softColor: colors.primarySoft,
    description: "Coming back to full strength.",
    segments: 4,
  },
  resolved: {
    label: "Resolved",
    color: colors.primary,
    softColor: colors.primarySoft,
    description: "At peace. You made a decision — nothing left to do.",
    segments: 5,
  },
};

export function healthExplanation(sub: Subscription): string {
  switch (sub.mood) {
    case "critical":
      return `${sub.creatureName} is critical because ${sub.merchant} ${
        sub.billingInterval === "trial" ? "ends today" : "renews today"
      } and has not been reviewed.`;
    case "sick":
      return `${sub.creatureName} is sick because this subscription renews ${
        sub.daysRemaining === 1 ? "tomorrow" : `in ${sub.daysRemaining} days`
      } and has not been reviewed.`;
    case "concerned":
      return `${sub.creatureName} is concerned — ${sub.merchant} renews in ${sub.daysRemaining} days.`;
    case "resolved":
      return `${sub.creatureName} can rest now. This subscription has been taken care of.`;
    case "reviving":
      return `${sub.creatureName} is recovering after your decision.`;
    default:
      return `${sub.creatureName} is ${sub.mood} — the next renewal is ${sub.daysRemaining} days away.`;
  }
}

export function formatMoney(value: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency.toUpperCase()} ${value.toFixed(2)}`;
  }
}

export function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function daysLabel(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}
