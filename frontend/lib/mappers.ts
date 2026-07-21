import { SubscriptionDto } from "../types/api";
import {
  BillingInterval,
  CreatureMood,
  CreatureSpecies,
  Subscription,
  SubscriptionCategory,
} from "../types/subscription";
import { assignCreature } from "./creatureAssign";

const species = new Set<CreatureSpecies>([
  "cloud", "sprout", "blob", "ember", "egg", "gem", "penny", "milo", "nori", "benny", "tilly", "rory", "pip",
  "delivery", "fitness", "music", "news", "phone", "video", "weather",
]);
const moods = new Set<CreatureMood>([
  "happy", "healthy", "concerned", "sick", "critical", "reviving", "resolved",
]);
const categories = new Set<SubscriptionCategory>([
  "Entertainment", "Streaming", "Music", "Productivity", "Fitness", "Storage", "Delivery",
  "News", "Mobile", "Other",
]);
const subscriptionMascotSpecies = new Set<CreatureSpecies>([
  "delivery", "fitness", "music", "news", "phone", "video", "weather",
]);

function money(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapSubscription(dto: SubscriptionDto): Subscription {
  const billingInterval: BillingInterval = dto.billing_cycle === "one_time" ? "yearly" : dto.billing_cycle;
  const category = categories.has(dto.category as SubscriptionCategory)
    ? (dto.category as SubscriptionCategory)
    : "Other";
  const savedSpecies = species.has(dto.creature_species as CreatureSpecies)
    ? (dto.creature_species as CreatureSpecies)
    : null;
  // Legacy records were created before these PNG mascots existed. Render them
  // with the new type-specific character without changing database history.
  const displaySpecies = savedSpecies && subscriptionMascotSpecies.has(savedSpecies)
    ? savedSpecies
    : assignCreature(category, dto.vendor_name, dto.display_name).species;
  return {
    id: dto.id,
    merchant: dto.vendor_name,
    displayName: dto.display_name,
    creatureName: dto.creature_name,
    species: displaySpecies,
    price: money(dto.amount),
    previousPrice: dto.previous_amount == null ? undefined : money(dto.previous_amount),
    billingInterval,
    nextActionDate: dto.renewal_or_expiry_date ?? "",
    daysRemaining: dto.days_remaining ?? 0,
    mood: moods.has(dto.mood as CreatureMood) ? (dto.mood as CreatureMood) : "healthy",
    healthScore: dto.health_score,
    category,
    annualCost: money(dto.annual_cost),
    monthlyCost: money(dto.monthly_cost),
    needsAttention: dto.needs_attention,
    attentionState: dto.attention_state,
    healthReason: dto.health_reason,
    priceHikeDetected: dto.price_hike_detected,
    nextTransitionAt: dto.next_transition_at,
    currency: dto.currency,
    status: dto.status === "canceled" ? "cancelled" : dto.status,
    notes: dto.notes ?? undefined,
    cancellationDifficulty: dto.cancellation_difficulty,
  };
}
