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
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { Card } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useSubscriptionStore } from "../../store/useSubscriptionStore";
import { formatMoney, moodMeta } from "../../utils/creatureMood";
import { CreatureMood, SubscriptionCategory } from "../../types/subscription";

const categoryColors: Record<SubscriptionCategory, string> = {
  Entertainment: colors.primary,
  Productivity: colors.secondary,
  Fitness: colors.warning,
  Storage: colors.primaryLight,
  Other: colors.textMuted,
};

function AnimatedBar({ fraction, color, delay }: { fraction: number; color: string; delay: number }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withDelay(
      delay,
      withTiming(fraction, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
  }, [fraction, delay, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { backgroundColor: color }, style]} />
    </View>
  );
}

const trend = [92.5, 96.9, 89.4, 94.2, 96.96, 84.96];
const trendLabels = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];

export default function InsightsScreen() {
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
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
    { label: "Potential savings", value: formatMoney(potentialSavings), tint: colors.success },
  ];

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={type.title}>Insights</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {(["Month", "Year"] as const).map((p) => (
            <Chip key={p} label={p} selected={period === p} onPress={() => setPeriod(p)} />
          ))}
        </View>
      </View>

      <View style={styles.metricGrid}>
        {metrics.map((m) => (
          <Card key={m.label} style={styles.metricCard}>
            <Text style={[styles.metricValue, m.tint ? { color: m.tint } : null]}>{m.value}</Text>
            <Text style={type.caption}>{m.label.toUpperCase()}</Text>
          </Card>
        ))}
      </View>

      <SectionHeader title="Category breakdown" />
      <Card>
        {Object.entries(byCategory).map(([cat, amount], i) => (
          <View key={cat} style={styles.categoryRow}>
            <View style={styles.categoryLabelRow}>
              <Text style={styles.categoryLabel}>{cat}</Text>
              <Text style={styles.categoryAmount}>{formatMoney(amount)}/mo</Text>
            </View>
            <AnimatedBar
              fraction={amount / maxCategory}
              color={categoryColors[cat as SubscriptionCategory] ?? colors.textMuted}
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
                      backgroundColor: i === trend.length - 1 ? colors.primary : colors.surfaceRaised,
                    },
                  ]}
                />
              </View>
              <Text style={styles.trendLabel}>{trendLabels[i]}</Text>
            </View>
          ))}
        </View>
        <Text style={[type.bodySmall, { marginTop: spacing.sm }]}>
          Six-month recurring spend. July is your lowest so far.
        </Text>
      </Card>

      <SectionHeader title="Most expensive" />
      <Card>
        {topThree.map((s, i) => (
          <View key={s.id} style={[styles.rankRow, i > 0 && styles.rankDivider]}>
            <Text style={styles.rankNum}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rankName}>{s.displayName}</Text>
              <Text style={type.caption}>{s.merchant}</Text>
            </View>
            <Text style={styles.rankPrice}>{formatMoney(s.price)}/mo</Text>
          </View>
        ))}
      </Card>

      <SectionHeader title="Price changes" />
      <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 }}>
        <View style={styles.priceIcon}>
          <TrendingUp size={18} color={colors.warning} />
        </View>
        <Text style={[type.body, { flex: 1 }]}>
          StreamFlix increased by $2.00 last month.
        </Text>
      </Card>

      <SectionHeader title="Creature health" />
      <Card style={{ gap: spacing.sm }}>
        {(Object.entries(moodCounts) as [CreatureMood, number][]).map(([mood, count]) => (
          <View key={mood} style={styles.healthRow}>
            <View style={[styles.healthDot, { backgroundColor: moodMeta[mood].color }]} />
            <Text style={[type.body, { flex: 1 }]}>{moodMeta[mood].label}</Text>
            <Text style={styles.healthCount}>{count}</Text>
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
          <Text style={type.body}>{tip}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metricCard: { flexBasis: "47%", flexGrow: 1, gap: 4 },
  metricValue: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  categoryRow: { marginBottom: spacing.sm + 4 },
  categoryLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  categoryLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  categoryAmount: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    height: 10,
    borderRadius: 8,
    backgroundColor: colors.backgroundRaised,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 8 },
  trendRow: { flexDirection: "row", gap: spacing.sm, height: 120 },
  trendCol: { flex: 1, alignItems: "center" },
  trendBarArea: { flex: 1, width: "100%", justifyContent: "flex-end" },
  trendBar: { width: "100%", borderRadius: 8 },
  trendLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted, marginTop: 6 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, paddingVertical: spacing.sm },
  rankDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rankNum: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.primaryLight,
    width: 22,
    textAlign: "center",
  },
  rankName: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  rankPrice: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  priceIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  healthRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  healthDot: { width: 10, height: 10, borderRadius: 10 },
  healthCount: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
});
