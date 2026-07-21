import React from "react";
import { useRouter } from "expo-router";
import {
  ArrowUpRight,
  BellRing,
  CalendarClock,
  ChevronRight,
  Gift,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { AmbienceButton } from "../../components/onboarding/GardenAmbience";
import { GardenModeButton } from "../../components/onboarding/GardenModeButton";
import { InlineResourceState } from "../../components/price/PriceIntelligenceCards";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { GardenKicker } from "../../components/ui/GardenKit";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useGardenPalette } from "../../constants/garden";
import { fonts, spacing } from "../../constants/theme";
import { usePriceDashboardItems } from "../../lib/usePriceIntelligence";
import { useSubscriptionData } from "../../lib/useSubscriptionData";
import { useUIStore } from "../../store/useUIStore";
import { DealDto, RecommendationDto, SubscriptionIntelligenceDto } from "../../types/priceIntelligence";
import { Subscription } from "../../types/subscription";
import { billingSuffix, daysLabel, formatMoney } from "../../utils/creatureMood";

const asNumber = (value: string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function checkedLabel(value?: string) {
  if (!value || value.startsWith("1970")) return "Updating now";
  const checkedAt = new Date(value);
  if (Number.isNaN(checkedAt.getTime())) return "Updating now";
  return `Updated ${checkedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function recommendationTitle(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function InsightsScreen() {
  const p = useGardenPalette();
  const router = useRouter();
  const currency = useUIStore((state) => state.currency);
  const subscriptions = useSubscriptionData();
  const dashboard = usePriceDashboardItems(subscriptions.subscriptions.map((item) => item.id));
  const summary = dashboard.data?.summary;

  const activeSubscriptions = React.useMemo(
    () => subscriptions.subscriptions.filter((subscription) => subscription.status === "active"),
    [subscriptions.subscriptions],
  );
  const intelligenceBySubscription = React.useMemo(() => new Map(
    (dashboard.data?.intelligence ?? []).map((item) => [item.subscription_id, item]),
  ), [dashboard.data]);
  const recommendations = React.useMemo(() => (dashboard.data?.intelligence ?? [])
    .flatMap((item) => item.recommendations)
    .filter((item) => item.status === "active" || item.status === "seen")
    .sort((a, b) => asNumber(b.estimated_monthly_savings) - asNumber(a.estimated_monthly_savings)), [dashboard.data]);
  const deals = React.useMemo(() => (dashboard.data?.deals ?? [])
    .flatMap((item) => item.items)
    .filter((item) => !item.expires_at || new Date(item.expires_at).getTime() > Date.now()), [dashboard.data]);
  const prioritySubscriptions = React.useMemo(() => activeSubscriptions
    .filter((item) => item.priceHikeDetected || item.needsAttention || item.daysRemaining <= 7)
    .sort((a, b) => Number(b.priceHikeDetected) - Number(a.priceHikeDetected) || a.daysRemaining - b.daysRemaining)
    .slice(0, 3), [activeSubscriptions]);
  const intelligenceList = React.useMemo(() => [...activeSubscriptions]
    .sort((a, b) => Number(b.priceHikeDetected || b.needsAttention) - Number(a.priceHikeDetected || a.needsAttention) || a.daysRemaining - b.daysRemaining), [activeSubscriptions]);

  const monthlySpend = activeSubscriptions.reduce((total, item) => total + (item.monthlyCost ?? item.price), 0);
  const monthlySavings = asNumber(summary?.estimated_monthly_savings);
  const annualSavings = asNumber(summary?.estimated_annual_savings);
  const priceChanges = summary?.price_change_count ?? activeSubscriptions.filter((item) => item.priceHikeDetected).length;
  const loading = subscriptions.loading || dashboard.loading;
  const error = subscriptions.error ?? dashboard.error?.message;
  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <GardenKicker>YOUR MONEY, MADE CLEAR</GardenKicker>
          <Text style={[styles.title, { color: p.ink }]}>Savings radar</Text>
          <Text style={[styles.subtitle, { color: p.body }]}>A calm view of what changed and where you can save.</Text>
        </View>
        <View style={styles.controls}><AmbienceButton compact /><GardenModeButton compact /></View>
      </View>

      <InlineResourceState
        loading={dashboard.loading}
        error={dashboard.error?.message}
        onRetry={() => void dashboard.refresh()}
      />
      {!loading && !error && activeSubscriptions.length === 0 ? (
        <Card raised style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: p.successBg }]}><Sparkles size={22} color={p.success} /></View>
          <Text style={[styles.cardTitle, { color: p.ink }]}>Your radar is ready</Text>
          <Text style={[styles.body, { color: p.body }]}>Add a subscription and we’ll keep an eye on renewals, price changes, and better options.</Text>
          <Button label="Add a subscription" onPress={() => router.push("/add")} />
        </Card>
      ) : null}

      {activeSubscriptions.length > 0 ? (
        <>
          <Card raised style={{ ...styles.radarCard, borderColor: p.goldBorder }}>
            <View style={styles.radarTop}>
              <View>
                <Text style={[styles.radarLabel, { color: p.muted }]}>POSSIBLE SAVINGS</Text>
                <Text style={[styles.radarValue, { color: p.inkStrong }]}>{formatMoney(monthlySavings, currency)}<Text style={styles.perMonth}>/mo</Text></Text>
              </View>
              <View style={[styles.verifiedPill, { backgroundColor: p.successBg, borderColor: p.success }]}>
                <ShieldCheck size={14} color={p.success} />
                <Text style={[styles.verifiedText, { color: p.success }]}>MONITORED</Text>
              </View>
            </View>
            <View style={[styles.radarRule, { backgroundColor: p.cardBorder }]} />
            <View style={styles.radarMetrics}>
              <Metric value={formatMoney(monthlySpend, currency)} label="MONTHLY SPEND" />
              <Metric value={formatMoney(annualSavings, currency)} label="YEARLY OPPORTUNITY" />
              <Metric value={String(priceChanges)} label="PRICE CHANGES" />
            </View>
            <Text style={[styles.freshness, { color: p.muted }]}>{checkedLabel(summary?.generated_at)} · {activeSubscriptions.length} subscriptions watched</Text>
          </Card>

          <SectionHeader title="Needs attention" />
          {prioritySubscriptions.length ? (
            <View style={styles.stack}>
              {prioritySubscriptions.map((subscription) => (
                <AttentionCard key={subscription.id} subscription={subscription} currency={currency} onPress={() => router.push(`/subscription/${subscription.id}`)} />
              ))}
            </View>
          ) : (
            <AllClearCard />
          )}

          <SectionHeader title="Best ways to save" />
          {recommendations.length ? (
            <View style={styles.stack}>
              {recommendations.slice(0, 3).map((recommendation) => (
                <SavingsCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  currency={currency}
                  onPress={() => router.push(`/subscription/${recommendation.subscription_id}`)}
                />
              ))}
            </View>
          ) : deals.length ? (
            <View style={styles.stack}>{deals.slice(0, 2).map((deal) => <DealHighlight key={deal.id} deal={deal} currency={currency} />)}</View>
          ) : (
            <Card><Text style={[styles.body, { color: p.muted }]}>No worthwhile changes right now. We’ll surface savings as soon as we find them.</Text></Card>
          )}

          <SectionHeader title="Subscription intelligence" />
          <View style={styles.stack}>
            {intelligenceList.map((subscription) => (
              <SubscriptionRow
                key={subscription.id}
                subscription={subscription}
                intelligence={intelligenceBySubscription.get(subscription.id)}
                currency={currency}
                onPress={() => router.push(`/subscription/${subscription.id}`)}
              />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  const p = useGardenPalette();
  return <View style={styles.metric}><Text style={[styles.metricValue, { color: p.ink }]} numberOfLines={1}>{value}</Text><Text style={[styles.metricLabel, { color: p.muted }]}>{label}</Text></View>;
}

function AttentionCard({ subscription, currency, onPress }: { subscription: Subscription; currency: string; onPress: () => void }) {
  const p = useGardenPalette();
  const hasPriceChange = subscription.priceHikeDetected;
  const change = subscription.previousPrice !== undefined ? subscription.price - subscription.previousPrice : 0;
  return (
    <Card onPress={onPress} accessibilityLabel={`View ${subscription.displayName} details`} style={styles.attentionCard}>
      <View style={[styles.statusIcon, { backgroundColor: hasPriceChange ? p.dangerBg : p.warningBg }]}>
        {hasPriceChange ? <TrendingUp size={20} color={p.danger} /> : <BellRing size={20} color={p.warning} />}
      </View>
      <View style={styles.grow}>
        <Text style={[styles.cardTitle, { color: p.ink }]}>{subscription.displayName}</Text>
        <Text style={[styles.body, { color: p.body }]}>{hasPriceChange ? (change > 0 ? `Price rose by ${formatMoney(change, currency)}` : "A price change was detected") : `Renews ${daysLabel(subscription.daysRemaining).toLowerCase()}`}</Text>
      </View>
      <ChevronRight size={21} color={p.muted} />
    </Card>
  );
}

function SavingsCard({ recommendation, currency, onPress }: { recommendation: RecommendationDto; currency: string; onPress: () => void }) {
  const p = useGardenPalette();
  const amount = asNumber(recommendation.estimated_monthly_savings);
  return (
    <Card onPress={onPress} accessibilityLabel={`View saving opportunity for subscription`} style={styles.savingsCard}>
      <View style={[styles.statusIcon, { backgroundColor: p.successBg }]}><TrendingDown size={20} color={p.success} /></View>
      <View style={styles.grow}>
        <Text style={[styles.eyebrow, { color: p.success }]}>{recommendationTitle(recommendation.recommendation_type)}</Text>
        <Text style={[styles.cardTitle, { color: p.ink }]} numberOfLines={1}>{recommendation.explanation}</Text>
        {amount > 0 ? <Text style={[styles.savingsAmount, { color: p.success }]}>Save {formatMoney(amount, currency)}/mo</Text> : null}
      </View>
      <ArrowUpRight size={19} color={p.accent} />
    </Card>
  );
}

function DealHighlight({ deal, currency }: { deal: DealDto; currency: string }) {
  const p = useGardenPalette();
  const price = asNumber(deal.promotional_price ?? deal.regular_price);
  return (
    <Card style={styles.savingsCard}>
      <View style={[styles.statusIcon, { backgroundColor: p.warningBg }]}><Gift size={20} color={p.warning} /></View>
      <View style={styles.grow}>
        <Text style={[styles.eyebrow, { color: p.warning }]}>ACTIVE DEAL</Text>
        <Text style={[styles.cardTitle, { color: p.ink }]}>{deal.title}</Text>
        {price > 0 ? <Text style={[styles.body, { color: p.body }]}>From {formatMoney(price, deal.currency ?? currency)}</Text> : null}
      </View>
    </Card>
  );
}

function SubscriptionRow({ subscription, intelligence, currency, onPress }: {
  subscription: Subscription; intelligence?: SubscriptionIntelligenceDto; currency: string; onPress: () => void;
}) {
  const p = useGardenPalette();
  const latest = intelligence?.latest_price;
  const currentPrice = latest ? asNumber(latest.price) : subscription.price;
  const changed = latest?.change_type === "increase" || subscription.priceHikeDetected;
  const provider = intelligence?.match?.provider_name;
  const plan = intelligence?.match?.plan_name;
  const detail = provider && plan ? `${provider} · ${plan}` : "Keeping an eye on this subscription";
  return (
    <Card onPress={onPress} accessibilityLabel={`Open ${subscription.displayName}`} style={styles.subscriptionRow}>
      <View style={[styles.subscriptionBadge, { backgroundColor: changed ? p.dangerBg : p.successBg }]}>
        {changed ? <TrendingUp size={18} color={p.danger} /> : <CalendarClock size={18} color={p.success} />}
      </View>
      <View style={styles.grow}>
        <Text style={[styles.cardTitle, { color: p.ink }]}>{subscription.displayName}</Text>
        <Text style={[styles.caption, { color: p.muted }]} numberOfLines={1}>{detail}</Text>
        <Text style={[styles.caption, { color: changed ? p.danger : p.body }]}>{changed ? "Price changed" : `Renews ${daysLabel(subscription.daysRemaining).toLowerCase()}`}</Text>
      </View>
      <View style={styles.priceColumn}>
        <Text style={[styles.rowPrice, { color: p.ink }]}>{formatMoney(currentPrice, subscription.currency ?? currency)}</Text>
        <Text style={[styles.caption, { color: p.muted }]}>{billingSuffix(subscription.billingInterval)}</Text>
      </View>
      <ChevronRight size={18} color={p.muted} />
    </Card>
  );
}

function AllClearCard() {
  const p = useGardenPalette();
  return <Card style={styles.allClear}><View style={[styles.statusIcon, { backgroundColor: p.successBg }]}><ShieldCheck size={20} color={p.success} /></View><View style={styles.grow}><Text style={[styles.cardTitle, { color: p.ink }]}>Everything looks good</Text><Text style={[styles.body, { color: p.body }]}>No urgent renewals or price increases right now.</Text></View></Card>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.sm },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.sm },
  headerCopy: { flex: 1, paddingRight: spacing.sm },
  controls: { flexDirection: "row", gap: spacing.sm },
  title: { fontFamily: fonts.pixelBold, fontSize: 27, letterSpacing: 0.2, marginTop: 2 },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, marginTop: 3 },
  radarCard: { gap: spacing.md, padding: spacing.md + 2 },
  radarTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  radarLabel: { fontFamily: fonts.pixelBold, fontSize: 10, letterSpacing: 0.8 },
  radarValue: { fontFamily: fonts.pixelBold, fontSize: 30, marginTop: 4, fontVariant: ["tabular-nums"] },
  perMonth: { fontFamily: fonts.medium, fontSize: 14 },
  verifiedPill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5 },
  verifiedText: { fontFamily: fonts.pixelBold, fontSize: 8, letterSpacing: 0.5 },
  radarRule: { height: 1, opacity: 0.45 },
  radarMetrics: { flexDirection: "row", gap: spacing.sm },
  metric: { flex: 1, gap: 3 },
  metricValue: { fontFamily: fonts.pixelBold, fontSize: 14, fontVariant: ["tabular-nums"] },
  metricLabel: { fontFamily: fonts.pixelBold, fontSize: 8, lineHeight: 11, letterSpacing: 0.35 },
  freshness: { fontFamily: fonts.medium, fontSize: 11 },
  stack: { gap: spacing.sm },
  attentionCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  allClear: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  savingsCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13 },
  grow: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: fonts.pixelBold, fontSize: 14, lineHeight: 19 },
  body: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, marginTop: 2 },
  eyebrow: { fontFamily: fonts.pixelBold, fontSize: 9, letterSpacing: 0.7, marginBottom: 2 },
  savingsAmount: { fontFamily: fonts.pixelBold, fontSize: 13, marginTop: 3 },
  subscriptionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 13 },
  subscriptionBadge: { width: 36, height: 36, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  caption: { fontFamily: fonts.medium, fontSize: 10, lineHeight: 15 },
  priceColumn: { alignItems: "flex-end", marginLeft: spacing.xs },
  rowPrice: { fontFamily: fonts.pixelBold, fontSize: 13, fontVariant: ["tabular-nums"] },
  emptyCard: { alignItems: "flex-start", gap: spacing.sm, padding: spacing.lg },
  emptyIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});
