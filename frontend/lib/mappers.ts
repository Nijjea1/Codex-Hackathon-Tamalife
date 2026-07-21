import { SubscriptionDto } from "../types/api";
import {
  BillingInterval,
  CreatureMood,
  CreatureSpecies,
  Subscription,
  SubscriptionCategory,
} from "../types/subscription";

const species = new Set<CreatureSpecies>(["cloud", "sprout", "blob", "ember", "egg", "gem"]);
const moods = new Set<CreatureMood>([
  "happy", "healthy", "concerned", "sick", "critical", "reviving", "resolved",
]);
const categories = new Set<SubscriptionCategory>([
  "Entertainment", "Productivity", "Fitness", "Storage", "Other",
]);

function money(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapSubscription(dto: SubscriptionDto): Subscription {
  const billingInterval: BillingInterval = dto.billing_cycle === "one_time" ? "yearly" : dto.billing_cycle;
  return {
    id: dto.id,
    merchant: dto.vendor_name,
    displayName: dto.display_name,
    creatureName: dto.creature_name,
    species: species.has(dto.creature_species as CreatureSpecies)
      ? (dto.creature_species as CreatureSpecies)
      : "blob",
    price: money(dto.amount),
    previousPrice: dto.previous_amount == null ? undefined : money(dto.previous_amount),
    billingInterval,
    nextActionDate: dto.renewal_or_expiry_date ?? "",
    daysRemaining: dto.days_remaining ?? 0,
    mood: moods.has(dto.mood as CreatureMood) ? (dto.mood as CreatureMood) : "healthy",
    healthScore: dto.health_score,
    category: categories.has(dto.category as SubscriptionCategory)
      ? (dto.category as SubscriptionCategory)
      : "Other",
    annualCost: money(dto.annual_cost),
    monthlyCost: money(dto.monthly_cost),
    needsAttention: dto.needs_attention,
    attentionState: dto.attention_state,
    healthReason: dto.health_reason,
    currency: dto.currency,
    status: dto.status === "canceled" ? "cancelled" : dto.status,
    notes: dto.notes ?? undefined,
    priceHikeDetected: dto.price_hike_detected,
    nextTransitionAt: dto.next_transition_at,
    cancellationDifficulty: dto.cancellation_difficulty,
  };
}
