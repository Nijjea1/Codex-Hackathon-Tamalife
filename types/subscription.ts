export type CreatureMood =
  | "happy"
  | "healthy"
  | "concerned"
  | "sick"
  | "critical"
  | "reviving"
  | "resolved";

export type CreatureSpecies =
  | "cloud"
  | "sprout"
  | "blob"
  | "ember"
  | "egg"
  | "gem"
  | "penny"
  | "milo"
  | "nori"
  | "benny"
  | "tilly"
  | "rory"
  | "pip";

export type BillingInterval = "monthly" | "yearly" | "weekly" | "trial";

export type SubscriptionCategory =
  | "Entertainment"
  | "Productivity"
  | "Fitness"
  | "Storage"
  | "Other";

export type ResolutionAction = "renew" | "cancel" | "acceptPrice" | "dispute" | "snooze";

export type Subscription = {
  id: string;
  merchant: string;
  displayName: string;
  creatureName: string;
  species: CreatureSpecies;
  price: number;
  previousPrice?: number;
  billingInterval: BillingInterval;
  nextActionDate: string;
  daysRemaining: number;
  mood: CreatureMood;
  healthScore: number;
  category: SubscriptionCategory;
  annualCost: number;
  status: "active" | "cancelled" | "renewed" | "snoozed";
  notes?: string;
  receiptText?: string;
  snoozeCount?: number;
};

export type ParsedReceipt = {
  name: string;
  merchant: string;
  price: number;
  previousPrice?: number;
  currency: string;
  billingInterval: BillingInterval;
  renewalDate: string;
  category: SubscriptionCategory;
  confidence: "High confidence" | "Medium confidence" | "Low confidence";
  evidence: { label: string; snippet: string }[];
};
