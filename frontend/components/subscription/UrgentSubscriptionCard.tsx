import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
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
  const p = useGardenPalette();
  return (
    <View style={[styles.card, { backgroundColor: p.dangerBg, borderColor: p.danger, shadowColor: p.cardShadow }]}>
      <View style={styles.row}>
        <View style={[styles.creatureWrap, { backgroundColor: p.overlay }]}>
          <Creature species={s.species} mood={s.mood} size="small" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: p.inkStrong }]}>{s.creatureName} is feeling unwell</Text>
          <Text style={[styles.sub, { color: p.body }]}>
            {s.merchant} {s.billingInterval === "trial" ? "ends" : "renews"}{" "}
            {daysLabel(s.daysRemaining).toLowerCase()}
          </Text>
          <Text style={[styles.price, { color: p.danger }]}>{formatMoney(s.price)}/month</Text>
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
    borderWidth: 2.5,
    borderRadius: 14,
    padding: spacing.md,
    shadowOffset: { width: 4, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  creatureWrap: { borderRadius: 12, padding: 6 },
  title: { fontFamily: fonts.pixelBold, fontSize: 15, marginBottom: 2 },
  sub: { fontFamily: fonts.medium, fontSize: 12 },
  price: { fontFamily: fonts.pixelBold, fontSize: 13, marginTop: 4, fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
});
