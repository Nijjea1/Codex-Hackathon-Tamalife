import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useGardenPalette } from "../../constants/garden";
import { fonts, radius, spacing } from "../../constants/theme";
import { Subscription } from "../../types/subscription";
import { daysLabel, formatMoney } from "../../utils/creatureMood";
import { MoodBadge } from "../subscription/MoodBadge";

type Props = {
  subscription: Subscription;
};

export function CreatureHoverCard({ subscription }: Props) {
  const palette = useGardenPalette();

  return (
    <View
      pointerEvents="none"
      style={[
        styles.card,
        {
          backgroundColor: palette.cardBg,
          borderColor: palette.cardBorder,
          shadowColor: palette.cardShadow,
        },
      ]}
    >
      <View style={styles.heading}>
        <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
          {subscription.creatureName}
        </Text>
        <MoodBadge mood={subscription.mood} small />
      </View>
      <View style={styles.details}>
        <Text style={[styles.price, { color: palette.ink }]}>
          {formatMoney(subscription.price)}
        </Text>
        <Text style={[styles.renewal, { color: palette.muted }]}>
          {daysLabel(subscription.daysRemaining)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 190,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderRadius: radius.md,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  details: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  price: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  renewal: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
});
