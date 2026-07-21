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
import { Creature } from "../../components/creatures/Creature";
import { PriceHikeNotice } from "../../components/subscription/PriceHikeNotice";
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

      <View style={styles.creaturePreview}>
        <Creature species={subscription.species} mood={subscription.mood} size="medium" />
      </View>
      <Card style={{ gap: 5 }}>
        <Text style={[styles.price, { color: p.inkStrong }]}>{formatMoney(subscription.price, subscription.currency)} {subscription.billingInterval}</Text>
        <Text style={[styles.body, { color: p.body }]}>Renews {formatDate(subscription.nextActionDate)} · {daysLabel(subscription.daysRemaining)}</Text>
        <Text style={[styles.body, { color: subscription.needsAttention ? p.warning : p.success }]}>{subscription.healthReason ?? `${subscription.healthScore}% healthy`}</Text>
      </Card>
      <PriceHikeNotice subscription={subscription} />

      <SectionHeader title="Provider tracking" />
      <InlineResourceState loading={pricing.intelligence.loading} error={pricing.intelligence.error?.message} onRetry={() => void pricing.intelligence.refresh()} />
      {pricing.intelligence.data && !pricing.intelligence.loading && (
        pricing.intelligence.data.match ? <MerchantMatchCard match={pricing.intelligence.data.match} /> : (
          <Card style={{ gap: 5 }}>
            <Text style={[styles.price, { color: p.ink }]}>{subscription.merchant}</Text>
            <Text style={[styles.body, { color: p.body }]}>We are matching this subscription to official pricing pages automatically.</Text>
            <Text style={[styles.caption, { color: p.muted }]}>Your saved price is {formatMoney(subscription.price, subscription.currency)} {subscription.billingInterval}.</Text>
          </Card>
        )
      )}

      <SectionHeader title="Price history" />
      <InlineResourceState
        loading={pricing.history.loading}
        error={pricing.history.error?.message}
        empty={undefined}
        onRetry={() => void pricing.history.refresh()}
      />
      {!!pricing.history.data?.items.length ? <PriceHistoryCard items={pricing.history.data.items} /> : !pricing.history.loading && (
        <Card style={{ gap: 5 }}>
          <Text style={[styles.price, { color: p.ink }]}>{formatMoney(subscription.price, subscription.currency)}</Text>
          <Text style={[styles.body, { color: p.body }]}>Your recorded {subscription.billingInterval} price</Text>
          <Text style={[styles.caption, { color: p.muted }]}>Tamalife will add verified provider history after an official source is available.</Text>
        </Card>
      )}

      <SectionHeader title="Active deals" />
      <InlineResourceState
        loading={pricing.deals.loading}
        error={pricing.deals.error?.message}
        empty={undefined}
        onRetry={() => void pricing.deals.refresh()}
      />
      {!!pricing.deals.data?.items.length ? <DealsCard items={pricing.deals.data.items} /> : !pricing.deals.loading && (
        <Card style={{ gap: 5 }}>
          <Text style={[styles.price, { color: p.success }]}>No better verified deal found</Text>
          <Text style={[styles.body, { color: p.body }]}>We checked available official {subscription.merchant} pricing and did not find an eligible deal below your recorded price.</Text>
          <Text style={[styles.caption, { color: p.muted }]}>Deal watch stays active and will add a verified offer here if one appears.</Text>
        </Card>
      )}

      <SectionHeader title="Cheaper alternatives" />
      <InlineResourceState
        loading={pricing.alternatives.loading}
        error={pricing.alternatives.error?.message}
        empty={undefined}
        onRetry={() => void pricing.alternatives.refresh()}
      />
      {!!pricing.alternatives.data?.items.length ? <AlternativesCard items={pricing.alternatives.data.items} /> : !pricing.alternatives.loading && (
        <Card style={{ gap: 5 }}>
          <Text style={[styles.price, { color: p.success }]}>No better verified plan found</Text>
          <Text style={[styles.body, { color: p.body }]}>Your current {subscription.merchant} cost is {formatMoney(subscription.annualCost, subscription.currency)} per year, and no lower-cost comparable plan was verified.</Text>
          <Text style={[styles.caption, { color: p.muted }]}>We will replace this with savings details when a verified alternative appears.</Text>
        </Card>
      )}

      <SectionHeader title="Recommended actions" />
      {pricing.intelligence.data?.recommendations.length ? (
        <RecommendationsCard items={pricing.intelligence.data.recommendations} />
      ) : (
        !pricing.intelligence.loading && (
          <Card style={{ gap: 5 }}>
            <Text style={[styles.price, { color: p.ink }]}>Review before renewal</Text>
            <Text style={[styles.body, { color: p.body }]}>{subscription.merchant} renews {formatDate(subscription.nextActionDate)}.</Text>
            <Text style={[styles.caption, { color: p.muted }]}>We will add price-change and savings actions when verified intelligence arrives.</Text>
          </Card>
        )
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  title: { fontFamily: fonts.pixelBold, fontSize: 22 },
  price: { fontFamily: fonts.pixelBold, fontSize: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
  creaturePreview: { alignItems: "center", marginBottom: spacing.sm },
  body: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
});
