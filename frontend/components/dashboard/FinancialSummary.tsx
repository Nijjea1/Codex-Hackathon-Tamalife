import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { TrendingDown } from "lucide-react-native";
import { colors, fonts, spacing, type } from "../../constants/theme";
import { formatMoney } from "../../utils/creatureMood";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Card } from "../ui/Card";

type Props = { monthly: number; annual: number };

export function FinancialSummary({ monthly, annual }: Props) {
  return (
    <Card style={styles.card}>
      <Text style={type.caption}>RECURRING SPEND</Text>
      <View style={styles.moneyRow}>
        <AnimatedNumber value={monthly} />
        <Text style={styles.per}>/ month</Text>
      </View>
      <Text style={type.bodySmall}>{formatMoney(annual)} annually</Text>
      <View style={styles.trend}>
        <TrendingDown size={14} color={colors.success} />
        <Text style={styles.trendText}>Down $12 this month</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  moneyRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  per: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.textMuted, marginBottom: 6 },
  trend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
    backgroundColor: colors.successSoft,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  trendText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.success },
});
