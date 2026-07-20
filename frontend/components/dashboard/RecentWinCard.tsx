import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PartyPopper } from "lucide-react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { formatMoney } from "../../utils/creatureMood";
import { Creature } from "../creatures/Creature";

type Props = { merchant: string; annualAmount: number };

export function RecentWinCard({ merchant, annualAmount }: Props) {
  const p = useGardenPalette();
  return (
    <View style={[styles.card, { backgroundColor: p.successBg, borderColor: p.success, shadowColor: p.cardShadow }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <PartyPopper size={16} color={p.success} strokeWidth={2.5} />
          <Text style={[styles.title, { color: p.success }]}>Nice save!</Text>
        </View>
        <Text style={[styles.sub, { color: p.body }]}>
          You cancelled {merchant} and saved {formatMoney(annualAmount)}/year.
        </Text>
      </View>
      <View style={{ transform: [{ scale: 0.8 }] }}>
        <Creature species="blob" mood="resolved" size="small" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 2.5,
    borderRadius: 14,
    padding: spacing.md,
    shadowOffset: { width: 4, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 4,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  title: { fontFamily: fonts.pixelBold, fontSize: 15 },
  sub: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
});
