import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing, type } from "../../constants/theme";
import { Subscription } from "../../types/subscription";
import { daysLabel, formatDate, formatMoney, moodMeta } from "../../utils/creatureMood";
import { Creature } from "../creatures/Creature";
import { Card } from "../ui/Card";

type Props = { subscription: Subscription; onPress: () => void };

export function RenewalRow({ subscription: s, onPress }: Props) {
  const meta = moodMeta[s.mood];
  return (
    <Card
      onPress={onPress}
      style={styles.card}
      accessibilityLabel={`${s.displayName}, ${formatDate(s.nextActionDate)}, ${formatMoney(s.price)}, ${meta.label}`}
    >
      <View style={styles.row}>
        <View style={{ transform: [{ scale: 0.75 }], width: 58, alignItems: "center" }}>
          <Creature species={s.species} mood={s.mood} size="small" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{s.displayName}</Text>
          <Text style={type.bodySmall}>
            {formatDate(s.nextActionDate)} · {daysLabel(s.daysRemaining)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.price}>{formatMoney(s.price)}</Text>
          <Text style={[styles.state, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.sm + 4, marginBottom: spacing.sm + 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginBottom: 2 },
  price: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  state: { fontFamily: fonts.semiBold, fontSize: 12, marginTop: 2 },
});
