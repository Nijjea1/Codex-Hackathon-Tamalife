import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing } from "../../constants/theme";
import { Subscription } from "../../types/subscription";
import { daysLabel, formatMoney } from "../../utils/creatureMood";
import { MoodBadge } from "../subscription/MoodBadge";

type Props = {
  subscription: Subscription;
};

export function CreatureHoverCard({ subscription }: Props) {
  return (
    <View pointerEvents="none" style={styles.card}>
      <View style={styles.heading}>
        <Text style={styles.name} numberOfLines={1}>
          {subscription.creatureName}
        </Text>
        <MoodBadge mood={subscription.mood} small />
      </View>
      <View style={styles.details}>
        <Text style={styles.price}>{formatMoney(subscription.price)}</Text>
        <Text style={styles.renewal}>{daysLabel(subscription.daysRemaining)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 190,
    padding: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    shadowColor: "#000",
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
    color: colors.text,
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
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  renewal: {
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
});
