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
  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={`Price increased for ${subscription.displayName}`}
      style={[styles.notice, compact && styles.compact, { backgroundColor: p.dangerBg, borderColor: p.danger }]}
    >
      <TrendingUp size={compact ? 14 : 17} color={p.danger} strokeWidth={2.8} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: p.danger }]}>PRICE INCREASE</Text>
        <Text style={[styles.body, { color: p.body }]}>
          {previous !== undefined
            ? `${formatMoney(previous)} -> ${formatMoney(subscription.price)}${increase !== null ? ` (+${formatMoney(increase)})` : ""}`
            : `Now ${formatMoney(subscription.price)} — review before renewal.`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, borderWidth: 1.5, borderRadius: 12, padding: spacing.sm + 2 },
  compact: { borderRadius: 9, paddingVertical: 7, paddingHorizontal: 8, marginTop: spacing.sm },
  title: { fontFamily: "monospace", fontWeight: "900", fontSize: 10, letterSpacing: 0.5 },
  body: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, marginTop: 1 },
});
