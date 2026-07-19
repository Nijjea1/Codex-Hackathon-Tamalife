import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { Subscription } from "../../types/subscription";
import { daysLabel, formatMoney } from "../../utils/creatureMood";
import { Creature } from "../creatures/Creature";
import { Button } from "../ui/Button";

type Props = {
  subscription: Subscription;
  onReview: () => void;
  onSnooze: () => void;
};

export function UrgentSubscriptionCard({ subscription: s, onReview, onSnooze }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.creatureWrap}>
          <Creature species={s.species} mood={s.mood} size="small" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{s.creatureName} is feeling unwell</Text>
          <Text style={type.bodySmall}>
            {s.merchant} {s.billingInterval === "trial" ? "ends" : "renews"}{" "}
            {daysLabel(s.daysRemaining).toLowerCase()}
          </Text>
          <Text style={styles.price}>{formatMoney(s.price)}/month</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button label="Review" onPress={onReview} style={{ flex: 1 }} />
        <Button label="Snooze" onPress={onSnooze} variant="ghost" style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(240,106,120,0.08)",
    borderWidth: 1,
    borderColor: "rgba(240,106,120,0.25)",
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  creatureWrap: {
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: radius.md,
    padding: 6,
  },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginBottom: 2 },
  price: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.danger,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
});
