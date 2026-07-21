import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { Subscription } from "../../types/subscription";
import { daysLabel, formatDate, formatMoney, moodMeta } from "../../utils/creatureMood";
import { Creature } from "../creatures/Creature";
import { GardenCard } from "../ui/GardenCard";

type Props = { subscription: Subscription; onPress: () => void };

export function RenewalRow({ subscription: s, onPress }: Props) {
  const p = useGardenPalette();
  const meta = moodMeta[s.mood];
  return (
    <GardenCard
      onPress={onPress}
      compact
      style={styles.card}
      accessibilityLabel={`${s.displayName}, ${formatDate(s.nextActionDate)}, ${formatMoney(s.price, s.currency)}, ${meta.label}`}
    >
      <View style={styles.row}>
        <View style={{ transform: [{ scale: 0.75 }], width: 58, alignItems: "center" }}>
          <Creature species={s.species} mood={s.mood} size="small" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: p.ink }]}>{s.displayName}</Text>
          <Text style={[styles.sub, { color: p.body }]}>
            {formatDate(s.nextActionDate)} · {daysLabel(s.daysRemaining)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.price, { color: p.inkStrong }]}>{formatMoney(s.price, s.currency)}</Text>
          <Text style={[styles.state, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
    </GardenCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm + 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { fontFamily: fonts.pixelBold, fontSize: 14, marginBottom: 2 },
  sub: { fontFamily: fonts.medium, fontSize: 12 },
  price: { fontFamily: fonts.pixelBold, fontSize: 15, fontVariant: ["tabular-nums"] },
  state: { fontFamily: "monospace", fontWeight: "900", fontSize: 11, marginTop: 2 },
});
