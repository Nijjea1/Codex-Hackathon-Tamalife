import { BillingCycleDto } from "./api";

export type SourceMetadataDto = {
  source_id: string;
  source_url: string;
  checked_at: string | null;
  confidence: number;
};

export type MerchantMatchDto = {
  id: string;
  provider_id: string;
  provider_plan_id: string;
  provider_name: string;
  plan_name: string;
  status: "pending" | "confirmed" | "rejected" | "unmatched";
  confidence: number;
  method: string;
  reason_codes: string[];
  updated_at: string;
};

export type PricePointDto = {
  id: string;
  price: string;
  promotional_price: string | null;
  previous_price: string | null;
  change_amount: string | null;
  change_percentage: string | null;
  change_type: "initial" | "increase" | "decrease" | "unchanged";
  observed_at: string;
  confidence: number;
  source: SourceMetadataDto;
};

export type DealDto = {
  id: string;
  title: string;
  description: string | null;
  regular_price: string | null;
  promotional_price: string | null;
  currency: string | null;
  country: string;
  eligibility: Record<string, unknown>;
  starts_at: string | null;
  expires_at: string | null;
  confidence: number;
  source: SourceMetadataDto;
};

export type AlternativeDto = {
  id: string;
  provider_plan_id: string;
  provider_name: string;
  plan_name: string;
  billing_cycle: BillingCycleDto;
  current_price: string;
  monthly_cost: string | null;
  monthly_savings: string | null;
  annual_savings: string | null;
  feature_similarity: number;
  switching_effort: number;
  reason_codes: string[];
  confidence: number;
  fresh_at: string;
};

export type RecommendationDto = {
  id: string;
  subscription_id: string;
  recommendation_type: string;
  target_plan_id: string | null;
  deal_id: string | null;
  estimated_monthly_savings: string | null;
  estimated_annual_savings: string | null;
  reason_codes: string[];
  explanation: string;
  confidence: number;
  status: "active" | "seen" | "dismissed" | "accepted" | "expired";
  expires_at: string | null;
  feedback: string | null;
  feedback_reason: string | null;
  updated_at: string;
};

export type PriceHistoryResponseDto = { subscription_id: string; items: PricePointDto[] };
export type DealsResponseDto = { subscription_id: string; items: DealDto[] };
export type AlternativesResponseDto = { subscription_id: string; items: AlternativeDto[] };
export type SubscriptionIntelligenceDto = {
  subscription_id: string;
  match: MerchantMatchDto | null;
  latest_price: PricePointDto | null;
  recommendations: RecommendationDto[];
  generated_at: string;
};
export type PriceIntelligenceSummaryDto = {
  subscription_count: number;
  matched_count: number;
  unmatched_count: number;
  price_change_count: number;
  active_deal_count: number;
  recommendation_count: number;
  estimated_monthly_savings: string;
  estimated_annual_savings: string;
  generated_at: string;
};
export type MatchConfirmationRequestDto = {
  match_id: string;
  status: "confirmed" | "rejected" | "unmatched";
  provider_plan_id: string | null;
  expected_updated_at: string;
};
export type MatchConfirmationResponseDto = { match: MerchantMatchDto };
export type RecommendationFeedbackRequestDto = {
  feedback: "helpful" | "not_helpful";
  status: "seen" | "dismissed" | "accepted";
  reason?: string | null;
};

export type PricePoint = Omit<PricePointDto, "price" | "promotional_price" | "previous_price" | "change_amount" | "change_percentage"> & {
  price: number;
  promotionalPrice: number | null;
  previousPrice: number | null;
  changeAmount: number | null;
  changePercentage: number | null;
};
export type Deal = DealDto & { regularPrice: number | null; promotionalPrice: number | null };
export type Alternative = AlternativeDto & {
  currentPrice: number;
  monthlyCost: number | null;
  monthlySavings: number | null;
  annualSavings: number | null;
};
