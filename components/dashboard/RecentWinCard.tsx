import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PartyPopper } from "lucide-react-native";
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { formatMoney } from "../../utils/creatureMood";
import { Creature } from "../creatures/Creature";

type Props = { merchant: string; annualAmount: number };

export function RecentWinCard({ merchant, annualAmount }: Props) {
  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <PartyPopper size={16} color={colors.success} />
          <Text style={styles.title}>Nice save!</Text>
        </View>
        <Text style={type.bodySmall}>
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
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: "rgba(98,217,139,0.25)",
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.success },
});
