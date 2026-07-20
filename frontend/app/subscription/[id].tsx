import { ChevronLeft } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  AlternativesCard,
  DealsCard,
  InlineResourceState,
  MerchantMatchCard,
  PriceHistoryCard,
  RecommendationsCard,
} from "../../components/price/PriceIntelligenceCards";
import { Card } from "../../components/ui/Card";
import { IconButton } from "../../components/ui/IconButton";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useGardenPalette } from "../../constants/garden";
import { fonts, spacing } from "../../constants/theme";
import { ApiError } from "../../lib/api";
import { useSubscriptionPriceIntelligence } from "../../lib/usePriceIntelligence";
import { useSubscriptionData } from "../../lib/useSubscriptionData";
import { useUIStore } from "../../store/useUIStore";
import { RecommendationDto } from "../../types/priceIntelligence";
import { daysLabel, formatDate, formatMoney } from "../../utils/creatureMood";

export default function SubscriptionDetailScreen() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const p = useGardenPalette();
  const showToast = useUIStore((state) => state.showToast);
  const subscriptionResource = useSubscriptionData(id);
  const subscription = subscriptionResource.subscriptions.find((item) => item.id === id);
  const pricing = useSubscriptionPriceIntelligence(id);

  const confirm = async (status: "confirmed" | "rejected") => {
    const match = pricing.intelligence.data?.match;
    if (!match) return;
    try {
      await pricing.confirmMatch({
        match_id: match.id,
        status,
        provider_plan_id: status === "confirmed" ? match.provider_plan_id : null,
        expected_updated_at: match.updated_at,
      });
      showToast({ message: status === "confirmed" ? "Provider match confirmed." : "Match rejected.", tone: "success" });
    } catch (error) {
      const stale = error instanceof ApiError && error.status === 409;
      showToast({ message: stale ? "That match changed, so we refreshed it." : (error as Error).message, tone: "warning" });
    }
  };

  const feedback = async (item: RecommendationDto, helpful: boolean) => {
    try {
      await pricing.submitFeedback(
        item.id,
        helpful
          ? { feedback: "helpful", status: "seen" }
          : { feedback: "not_helpful", status: "dismissed", reason: "Not relevant" },
      );
      showToast({ message: "Thanks â€” your feedback was saved.", tone: "success" });
    } catch (error) {
      showToast({ message: (error as Error).message, tone: "warning" });
    }
  };

  if (!subscription) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <Text style={[styles.title, { color: p.ink }]}>{subscriptionResource.loading ? "Loading subscriptionâ€¦" : "Subscription not found"}</Text>
        {subscriptionResource.error && <Text style={[styles.body, { color: p.danger }]}>{subscriptionResource.error}</Text>}
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Go back" icon={<ChevronLeft size={22} color={p.pillInk} />} onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: p.ink }]}>{subscription.displayName}</Text>
          <Text style={[styles.body, { color: p.muted }]}>{subscription.merchant}</Text>
        </View>
      </View>

      <Card style={{ gap: 5 }}>
        <Text style={[styles.price, { color: p.inkStrong }]}>{formatMoney(subscription.price)} {subscription.billingInterval}</Text>
        <Text style={[styles.body, { color: p.body }]}>Renews {formatDate(subscription.nextActionDate)} Â· {daysLabel(subscription.daysRemaining)}</Text>
        <Text style={[styles.body, { color: subscription.needsAttention ? p.warning : p.success }]}>{subscription.healthReason ?? `${subscription.healthScore}% healthy`}</Text>
      </Card>

      <SectionHeader title="Verified provider match" />
      <InlineResourceState loading={pricing.intelligence.loading} error={pricing.intelligence.error?.message} onRetry={() => void pricing.intelligence.refresh()} />
      {pricing.intelligence.data && !pricing.intelligence.loading && (
        <MerchantMatchCard
          match={pricing.intelligence.data.match}
          pending={pricing.matchPending}
          onConfirm={() => void confirm("confirmed")}
          onReject={() => void confirm("rejected")}
        />
      )}

      <SectionHeader title="Price history" />
      <InlineResourceState
        loading={pricing.history.loading}
        error={pricing.history.error?.message}
        empty={!pricing.history.loading && pricing.history.data?.items.length === 0 ? "No approved price history yet." : undefined}
        onRetry={() => void pricing.history.refresh()}
      />
      {!!pricing.history.data?.items.length && <PriceHistoryCard items={pricing.history.data.items} />}

      <SectionHeader title="Active deals" />
      <InlineResourceState
        loading={pricing.deals.loading}
        error={pricing.deals.error?.message}
        empty={!pricing.deals.loading && pricing.deals.data?.items.length === 0 ? "No approved deals for this plan right now." : undefined}
        onRetry={() => void pricing.deals.refresh()}
      />
      {!!pricing.deals.data?.items.length && <DealsCard items={pricing.deals.data.items} />}

      <SectionHeader title="Cheaper alternatives" />
      <InlineResourceState
        loading={pricing.alternatives.loading}
        error={pricing.alternatives.error?.message}
        empty={!pricing.alternatives.loading && pricing.alternatives.data?.items.length === 0 ? "No verified alternatives yet." : undefined}
        onRetry={() => void pricing.alternatives.refresh()}
      />
      {!!pricing.alternatives.data?.items.length && <AlternativesCard items={pricing.alternatives.data.items} />}

      <SectionHeader title="Recommended actions" />
      {pricing.intelligence.data?.recommendations.length ? (
        <RecommendationsCard
          items={pricing.intelligence.data.recommendations}
          pendingId={pricing.feedbackPending}
          onFeedback={(item, helpful) => void feedback(item, helpful)}
        />
      ) : (
        !pricing.intelligence.loading && <Card><Text style={[styles.body, { color: p.muted }]}>No recommendations for this subscription.</Text></Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  title: { fontFamily: fonts.pixelBold, fontSize: 22 },
  price: { fontFamily: fonts.pixelBold, fontSize: 20 },
  body: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
});
