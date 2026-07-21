import React from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AmbienceButton } from "../../components/onboarding/GardenAmbience";
import { GardenModeButton } from "../../components/onboarding/GardenModeButton";
import {
  DealsCard,
  InlineResourceState,
  RecommendationsCard,
} from "../../components/price/PriceIntelligenceCards";
import { Card } from "../../components/ui/Card";
import { GardenKicker } from "../../components/ui/GardenKit";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useGardenPalette } from "../../constants/garden";
import { fonts, spacing } from "../../constants/theme";
import { usePriceDashboardItems, usePriceIntelligenceSummary } from "../../lib/usePriceIntelligence";
import { useSubscriptionData } from "../../lib/useSubscriptionData";
import { useUIStore } from "../../store/useUIStore";
import { RecommendationDto } from "../../types/priceIntelligence";
import { formatMoney } from "../../utils/creatureMood";
import { useApiClient, createIdempotencyKey } from "../../lib/api";

export default function InsightsScreen() {
  const p = useGardenPalette();
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const api = useApiClient();
  const subscriptions = useSubscriptionData();
  const summary = usePriceIntelligenceSummary();
  const dashboard = usePriceDashboardItems(subscriptions.subscriptions.map((item) => item.id));
  const [feedbackPending, setFeedbackPending] = React.useState<string | null>(null);

  const unmatched = dashboard.data?.intelligence.filter((item) => item.match?.status !== "confirmed") ?? [];
  const recommendations = dashboard.data?.intelligence.flatMap((item) => item.recommendations)
    .filter((item) => item.status === "active" || item.status === "seen") ?? [];
  const deals = dashboard.data?.deals.flatMap((item) => item.items) ?? [];

  const feedback = async (item: RecommendationDto, helpful: boolean) => {
    setFeedbackPending(item.id);
    try {
      await api.recommendationFeedback(
        item.id,
        helpful
          ? { feedback: "helpful", status: "seen" }
          : { feedback: "not_helpful", status: "dismissed", reason: "Not relevant" },
        createIdempotencyKey(`feedback:${item.id}`),
      );
      await dashboard.refresh();
      showToast({ message: "Thanks â€” your feedback was saved.", tone: "success" });
    } catch (error) {
      showToast({ message: (error as Error).message, tone: "warning" });
    } finally {
      setFeedbackPending(null);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <GardenKicker>VERIFIED PRICING</GardenKicker>
          <Text style={[styles.title, { color: p.ink }]}>Price intelligence</Text>
        </View>
        <View style={styles.controls}><AmbienceButton compact /><GardenModeButton compact /></View>
      </View>

      <InlineResourceState
        loading={summary.loading}
        error={summary.error?.message}
        onRetry={() => void summary.refresh()}
      />
      {summary.data && !summary.loading && (
        <>
          {summary.refreshing && <Text style={[styles.status, { color: p.muted }]}>Refreshing verified pricesâ€¦</Text>}
          <View style={styles.metricGrid}>
            <Metric label="Possible monthly savings" value={formatMoney(Number(summary.data.estimated_monthly_savings))} />
            <Metric label="Possible annual savings" value={formatMoney(Number(summary.data.estimated_annual_savings))} />
            <Metric label="Active deals" value={`${summary.data.active_deal_count}`} />
            <Metric label="Price changes" value={`${summary.data.price_change_count}`} />
          </View>
          <Text style={[styles.freshness, { color: p.muted }]}>Checked {new Date(summary.data.generated_at).toLocaleString()}</Text>
        </>
      )}

      <InlineResourceState
        loading={subscriptions.loading || dashboard.loading}
        error={subscriptions.error ?? dashboard.error?.message}
        onRetry={() => void Promise.all([subscriptions.refresh(), dashboard.refresh()])}
      />

      {!dashboard.loading && dashboard.data && (
        <>
          <SectionHeader title="Needs match confirmation" />
          {unmatched.length === 0 ? (
            <Card><Text style={[styles.body, { color: p.muted }]}>Every tracked subscription with pricing data is matched.</Text></Card>
          ) : unmatched.map((item) => {
            const subscription = subscriptions.subscriptions.find((candidate) => candidate.id === item.subscription_id);
            return (
              <Card key={item.subscription_id} onPress={() => router.push(`/subscription/${item.subscription_id}`)} accessibilityLabel="Review provider match">
                <Text style={[styles.cardTitle, { color: p.ink }]}>{subscription?.displayName ?? "Subscription"}</Text>
                <Text style={[styles.body, { color: p.body }]}>
                  {item.match ? `Is this ${item.match.provider_name} ${item.match.plan_name}?` : "We haven't found a reliable provider match yet."}
                </Text>
              </Card>
            );
          })}

          <SectionHeader title="Verified deals" />
          {deals.length ? <DealsCard items={deals} /> : <Card><Text style={[styles.body, { color: p.muted }]}>No approved active deals right now.</Text></Card>}

          <SectionHeader title="Recommended actions" />
          {recommendations.length ? (
            <RecommendationsCard items={recommendations} pendingId={feedbackPending} onFeedback={(item, helpful) => void feedback(item, helpful)} />
          ) : <Card><Text style={[styles.body, { color: p.muted }]}>No new recommendations. We'll keep checking.</Text></Card>}
        </>
      )}
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const p = useGardenPalette();
  return (
    <Card style={styles.metricCard}>
      <Text style={[styles.metricValue, { color: p.inkStrong }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: p.muted }]}>{label.toUpperCase()}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.md },
  controls: { flexDirection: "row", gap: spacing.sm },
  title: { fontFamily: fonts.pixelBold, fontSize: 24, marginTop: 2 },
  status: { fontFamily: fonts.medium, fontSize: 12, marginTop: spacing.sm },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metricCard: { flexBasis: "47%", flexGrow: 1, gap: 4 },
  metricValue: { fontFamily: fonts.pixelBold, fontSize: 21 },
  metricLabel: { fontFamily: "monospace", fontWeight: "900", fontSize: 9, lineHeight: 13 },
  freshness: { fontFamily: fonts.medium, fontSize: 11, marginTop: spacing.sm },
  cardTitle: { fontFamily: fonts.pixelBold, fontSize: 15, marginBottom: 4 },
  body: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
});
