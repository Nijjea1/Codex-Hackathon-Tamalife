export type ItemTypeDto = "subscription" | "bill" | "warranty";
export type BillingCycleDto = "weekly" | "monthly" | "yearly" | "one_time" | "trial";
export type CancellationDifficultyDto = "easy" | "moderate" | "hard" | "unknown";
export type SubscriptionStatusDto = "active" | "canceled" | "disputed";

export type SubscriptionDto = {
  id: string;
  vendor_name: string;
  display_name: string;
  item_type: ItemTypeDto;
  category: string;
  amount: string;
  previous_amount: string | null;
  currency: string;
  billing_cycle: BillingCycleDto;
  renewal_or_expiry_date: string | null;
  cancellation_difficulty: CancellationDifficultyDto;
  status: SubscriptionStatusDto;
  creature_name: string;
  creature_species: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  days_remaining: number | null;
  health_score: number;
  mood: string;
  needs_attention: boolean;
  attention_state: "none" | "upcoming" | "urgent" | "overdue" | "resolved";
  health_reason: string;
  monthly_cost: string;
  annual_cost: string;
};

export type SubscriptionListDto = { items: SubscriptionDto[]; next_cursor: string | null };

export type SubscriptionWriteDto = {
  vendor_name: string;
  display_name: string;
  item_type?: ItemTypeDto;
  category?: string;
  amount: number;
  previous_amount?: number | null;
  currency?: string;
  billing_cycle: BillingCycleDto;
  renewal_or_expiry_date?: string | null;
  cancellation_difficulty?: CancellationDifficultyDto;
  creature_name?: string;
  creature_species?: string;
  notes?: string | null;
};

export type ExtractedReceiptDto = {
  display_name: string;
  vendor_name: string;
  item_type: ItemTypeDto;
  category: string;
  amount: string;
  previous_amount: string | null;
  currency: string;
  billing_cycle: BillingCycleDto;
  renewal_or_expiry_date: string | null;
  cancellation_difficulty: CancellationDifficultyDto;
  confidence: number;
  evidence: { label: string; snippet: string }[];
};

export type ParseResponseDto = {
  id: string;
  input_type: "text" | "image" | "document";
  status: "pending" | "completed" | "needs_review" | "confirmed" | "failed";
  prompt_version: string;
  storage_path: string | null;
  extracted: ExtractedReceiptDto | null;
  validation_errors: { [key: string]: unknown }[] | null;
  created_at: string;
};

export type ConfirmParseResponseDto = { subscription: SubscriptionDto };
export type NotificationPreferencesDto = {
  reminder_days_before: number[];
  push_enabled: boolean;
  email_enabled: boolean;
};
export type DevicePlatformDto = "ios" | "android";
export type DevicePushTokenRegisterDto = {
  token: string;
  platform: DevicePlatformDto;
};
export type DevicePushTokenDto = {
  id: string;
  platform: DevicePlatformDto;
  created_at: string;
  last_seen_at: string | null;
};
export type DashboardSummaryDto = {
  active_count: number;
  needs_attention_count: number;
  overdue_count: number;
  monthly_cost: string;
  annual_cost: string;
  next_item?: SubscriptionDto | null;
};
export type MeDto = {
  user_id: string;
  clerk_user_id: string;
  session_id: string | null;
  claims: Record<string, unknown>;
};
