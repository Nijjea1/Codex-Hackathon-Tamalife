import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { TrendingUp } from "lucide-react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette, GardenPalette } from "../../constants/garden";
import { Card } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { AmbienceButton } from "../../components/onboarding/GardenAmbience";
import { GardenModeButton } from "../../components/onboarding/GardenModeButton";
import { GardenKicker } from "../../components/ui/GardenKit";
import { formatMoney, moodMeta } from "../../utils/creatureMood";
import { CreatureMood, SubscriptionCategory } from "../../types/subscription";
import { useSubscriptionData } from "../../lib/useSubscriptionData";

function categoryColors(p: GardenPalette): Record<SubscriptionCategory, string> {
  return {
    Entertainment: p.gold,
    Productivity: p.leaf,
    Fitness: p.accent,
    Storage: p.pillBorder,
    Other: p.muted,
  };
}

function AnimatedBar({ fraction, color, delay, track }: { fraction: number; color: string; delay: number; track: string }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withDelay(
      delay,
      withTiming(fraction, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
  }, [fraction, delay, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View style={[styles.barTrack, { backgroundColor: track }]}>
      <Animated.View style={[styles.barFill, { backgroundColor: color }, style]} />
    </View>
  );
}

const trend = [92.5, 96.9, 89.4, 94.2, 96.96, 84.96];
const trendLabels = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];

export default function InsightsScreen() {
  const p = useGardenPalette();
  const { subscriptions, loading, error } = useSubscriptionData();
  const [period, setPeriod] = useState<"Month" | "Year">("Month");

  const active = subscriptions.filter((s) => s.status !== "cancelled");
  const monthly = active.reduce(
    (sum, s) => sum + (s.billingInterval === "yearly" ? s.price / 12 : s.price),
    0
  );
  const annual = active.reduce((sum, s) => sum + s.annualCost, 0);
  const potentialSavings = active
    .filter((s) => ["concerned", "sick", "critical"].includes(s.mood))
    .reduce((sum, s) => sum + s.annualCost, 0);

  const byCategory = active.reduce<Record<string, number>>((acc, s) => {
    acc[s.category] = (acc[s.category] ?? 0) + s.price;
    return acc;
  }, {});
  const maxCategory = Math.max(...Object.values(byCategory), 1);
  const catColors = categoryColors(p);

  const topThree = [...active].sort((a, b) => b.price - a.price).slice(0, 3);
  const maxTrend = Math.max(...trend);

  const moodCounts = subscriptions.reduce<Partial<Record<CreatureMood, number>>>((acc, s) => {
    acc[s.mood] = (acc[s.mood] ?? 0) + 1;
    return acc;
  }, {});

  const metrics = [
    { label: "Monthly spend", value: formatMoney(period === "Month" ? monthly : annual / 12) },
    { label: "Annual spend", value: formatMoney(annual) },
    { label: "Active subs", value: `${active.length}` },
    { label: "Potential savings", value: formatMoney(potentialSavings), tint: p.success },
  ];

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <GardenKicker>YOUR NUMBERS</GardenKicker>
          <Text style={[styles.title, { color: p.ink }]}>Insights</Text>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <AmbienceButton compact />
          <GardenModeButton compact />
        </View>
      </View>

      <View style={styles.periodRow}>
        {(["Month", "Year"] as const).map((pr) => (
          <Chip key={pr} label={pr} selected={period === pr} onPress={() => setPeriod(pr)} />
        ))}
      </View>

      {loading && <Text style={[styles.status, { color: p.muted }]}>Loading insights…</Text>}
      {error && <Text style={[styles.status, { color: p.danger }]}>{error}</Text>}

      <View style={styles.metricGrid}>
        {metrics.map((m) => (
          <Card key={m.label} style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: m.tint ?? p.inkStrong }]}>{m.value}</Text>
            <Text style={[styles.metricLabel, { color: p.muted }]}>{m.label.toUpperCase()}</Text>
          </Card>
        ))}
      </View>

      <SectionHeader title="Category breakdown" />
      <Card>
        {Object.entries(byCategory).map(([cat, amount], i) => (
          <View key={cat} style={styles.categoryRow}>
            <View style={styles.categoryLabelRow}>
              <Text style={[styles.categoryLabel, { color: p.ink }]}>{cat}</Text>
              <Text style={[styles.categoryAmount, { color: p.body }]}>{formatMoney(amount)}/mo</Text>
            </View>
            <AnimatedBar
              fraction={amount / maxCategory}
              color={catColors[cat as SubscriptionCategory] ?? p.muted}
              track={p.warningBg}
              delay={i * 120}
            />
          </View>
        ))}
      </Card>

      <SectionHeader title="Spending trend" />
      <Card>
        <View style={styles.trendRow}>
          {trend.map((v, i) => (
            <View key={i} style={styles.trendCol}>
              <View style={styles.trendBarArea}>
                <View
                  style={[
                    styles.trendBar,
                    {
                      height: `${(v / maxTrend) * 100}%`,
                      backgroundColor: i === trend.length - 1 ? p.gold : p.warningBg,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.trendLabel, { color: p.muted }]}>{trendLabels[i]}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.note, { color: p.body }]}>
          Six-month recurring spend. July is your lowest so far.
        </Text>
      </Card>

      <SectionHeader title="Most expensive" />
      <Card>
        {topThree.map((s, i) => (
          <View key={s.id} style={[styles.rankRow, i > 0 && { borderTopWidth: 1.5, borderTopColor: p.cardBorder }]}>
            <Text style={[styles.rankNum, { color: p.accent }]}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rankName, { color: p.ink }]}>{s.displayName}</Text>
              <Text style={[styles.rankSub, { color: p.muted }]}>{s.merchant}</Text>
            </View>
            <Text style={[styles.rankPrice, { color: p.inkStrong }]}>{formatMoney(s.price)}/mo</Text>
          </View>
        ))}
      </Card>

      <SectionHeader title="Price changes" />
      <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 }}>
        <View style={[styles.priceIcon, { backgroundColor: p.warningBg, borderColor: p.goldBorder }]}>
          <TrendingUp size={18} color={p.accent} strokeWidth={2.5} />
        </View>
        <Text style={[styles.tip, { flex: 1, color: p.body }]}>
          StreamFlix increased by $2.00 last month.
        </Text>
      </Card>

      <SectionHeader title="Creature health" />
      <Card style={{ gap: spacing.sm }}>
        {(Object.entries(moodCounts) as [CreatureMood, number][]).map(([mood, count]) => (
          <View key={mood} style={styles.healthRow}>
            <View style={[styles.healthDot, { backgroundColor: moodMeta[mood].color }]} />
            <Text style={[styles.tip, { flex: 1, color: p.body }]}>{moodMeta[mood].label}</Text>
            <Text style={[styles.healthCount, { color: p.inkStrong }]}>{count}</Text>
          </View>
        ))}
      </Card>

      <SectionHeader title="Savings opportunities" />
      {[
        "You have two entertainment subscriptions. Do you use both?",
        "Wobble has been snoozed three times. Time to decide?",
        "An annual plan may be cheaper than monthly billing for SoundWave.",
      ].map((tip) => (
        <Card key={tip} style={{ marginBottom: spacing.sm + 2 }}>
          <Text style={[styles.tip, { color: p.body }]}>{tip}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.pixelBold, fontSize: 24, letterSpacing: 0.5, marginTop: 2 },
  periodRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  status: { fontFamily: fonts.medium, fontSize: 13, marginBottom: spacing.sm },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metricCard: { flexBasis: "47%", flexGrow: 1, gap: 4 },
  metricValue: { fontFamily: fonts.pixelBold, fontSize: 22, fontVariant: ["tabular-nums"] },
  metricLabel: { fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.5 },
  categoryRow: { marginBottom: spacing.sm + 4 },
  categoryLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  categoryLabel: { fontFamily: fonts.pixelBold, fontSize: 13 },
  categoryAmount: { fontFamily: fonts.medium, fontSize: 13, fontVariant: ["tabular-nums"] },
  barTrack: { height: 12, borderRadius: 8, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 8 },
  trendRow: { flexDirection: "row", gap: spacing.sm, height: 120 },
  trendCol: { flex: 1, alignItems: "center" },
  trendBarArea: { flex: 1, width: "100%", justifyContent: "flex-end" },
  trendBar: { width: "100%", borderRadius: 8 },
  trendLabel: { fontFamily: fonts.medium, fontSize: 10, marginTop: 6 },
  note: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, marginTop: spacing.sm },
  rankRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, paddingVertical: spacing.sm },
  rankNum: { fontFamily: fonts.pixelBold, fontSize: 18, width: 22, textAlign: "center" },
  rankName: { fontFamily: fonts.pixelBold, fontSize: 14 },
  rankSub: { fontFamily: fonts.medium, fontSize: 12 },
  rankPrice: { fontFamily: fonts.pixelBold, fontSize: 14, fontVariant: ["tabular-nums"] },
  priceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  tip: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  healthRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  healthDot: { width: 12, height: 12, borderRadius: 12 },
  healthCount: { fontFamily: fonts.pixelBold, fontSize: 14 },
});
