import { TrendingUp } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useGardenPalette } from "../../constants/garden";
import { fonts, spacing } from "../../constants/theme";
import { Subscription } from "../../types/subscription";
import { formatMoney } from "../../utils/creatureMood";

export function PriceHikeNotice({ subscription, compact = false }: { subscription: Subscription; compact?: boolean }) {
  const p = useGardenPalette();
  if (!subscription.priceHikeDetected) return null;
  const previous = subscription.previousPrice;
  const increase = previous !== undefined && subscription.price > previous
    ? subscription.price - previous
    : null;
  // Opaque red-tinted card + red accent chip so the text stays legible over
  // the animated garden backdrop (translucent red washed out against it).
  const surface = p.isDay ? "#fdeae2" : "#3b2430";
  const ink = p.isDay ? "#7c2f22" : "#ffd9cd";
  const accent = p.isDay ? "#c2452f" : "#ff8a7a";
  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={`Price increased for ${subscription.displayName}`}
      style={[styles.notice, compact && styles.compact, { backgroundColor: surface, borderColor: accent, shadowColor: p.cardShadow }]}
    >
      <View style={[styles.iconChip, { backgroundColor: accent }]}>
        <TrendingUp size={compact ? 13 : 15} color={p.isDay ? "#fff5f0" : "#2a1620"} strokeWidth={3} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: accent }]}>PRICE INCREASE</Text>
        <Text style={[styles.body, { color: ink }]}>
          {previous !== undefined
            ? `${formatMoney(previous, subscription.currency)} -> ${formatMoney(subscription.price, subscription.currency)}${increase !== null ? ` (+${formatMoney(increase, subscription.currency)})` : ""}`
            : `Now ${formatMoney(subscription.price, subscription.currency)} — review before renewal.`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.sm + 2,
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 3,
  },
  compact: { borderRadius: 9, paddingVertical: 7, paddingHorizontal: 8, marginTop: spacing.sm },
  iconChip: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "monospace", fontWeight: "900", fontSize: 10, letterSpacing: 0.5 },
  body: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, marginTop: 1, fontVariant: ["tabular-nums"] },
});
