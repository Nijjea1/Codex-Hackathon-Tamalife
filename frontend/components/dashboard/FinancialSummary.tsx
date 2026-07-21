import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PiggyBank, Sprout } from "lucide-react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { formatMoney } from "../../utils/creatureMood";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { GardenCard } from "../ui/GardenCard";
import { GardenKicker } from "../ui/GardenKit";

type Props = { monthly: number; annual: number; savedPerYear?: number; activeCount?: number };

export function FinancialSummary({ monthly, annual, savedPerYear = 0, activeCount }: Props) {
  const p = useGardenPalette();
  const saved = savedPerYear > 0;
  return (
    <GardenCard style={styles.card}>
      <GardenKicker>RECURRING SPEND</GardenKicker>
      <View style={styles.moneyRow}>
        <AnimatedNumber value={monthly} style={[styles.money, { color: p.inkStrong }]} />
        <Text style={[styles.per, { color: p.muted }]}>/ month</Text>
      </View>
      <Text style={[styles.annual, { color: p.body }]}>{formatMoney(annual)} annually</Text>
      <View style={[styles.trend, { backgroundColor: saved ? p.successBg : p.warningBg }]}>
        {saved ? (
          <PiggyBank size={14} color={p.success} strokeWidth={2.5} />
        ) : (
          <Sprout size={14} color={p.accent} strokeWidth={2.5} />
        )}
        <Text style={[styles.trendText, { color: saved ? p.success : p.accent }]}>
          {saved
            ? `Saving ${formatMoney(savedPerYear)}/yr from cancellations`
            : `Tracking ${activeCount ?? 0} active item${activeCount === 1 ? "" : "s"}`}
        </Text>
      </View>
    </GardenCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  moneyRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 4 },
  money: { fontFamily: fonts.extraBold, fontSize: 34, lineHeight: 40, letterSpacing: 0.3, fontVariant: ["tabular-nums"] },
  per: { fontFamily: fonts.semiBold, fontSize: 15, marginBottom: 6 },
  annual: { fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  trend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  trendText: { fontFamily: "monospace", fontWeight: "900", fontSize: 11 },
});
