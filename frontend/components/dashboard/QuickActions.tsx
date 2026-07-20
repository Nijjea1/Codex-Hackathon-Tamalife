import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ClipboardPaste, Plus, Sparkles, TrendingUp } from "lucide-react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";

type Props = {
  onAdd: () => void;
  onPaste: () => void;
  onPriceChanges: () => void;
  onViewAll: () => void;
};

export function QuickActions({ onAdd, onPaste, onPriceChanges, onViewAll }: Props) {
  const p = useGardenPalette();
  const actions = [
    { label: "Add subscription", icon: Plus, onPress: onAdd },
    { label: "Paste receipt", icon: ClipboardPaste, onPress: onPaste },
    { label: "Price changes", icon: TrendingUp, onPress: onPriceChanges },
    { label: "All creatures", icon: Sparkles, onPress: onViewAll },
  ];
  return (
    <View style={styles.grid}>
      {actions.map(({ label, icon: Icon, onPress }) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: p.cardBg, borderColor: p.cardBorder, shadowColor: p.cardShadow },
            pressed && { transform: [{ translateY: 2 }] },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: p.warningBg, borderColor: p.goldBorder }]}>
            <Icon size={18} color={p.accent} strokeWidth={2.5} />
          </View>
          <Text style={[styles.label, { color: p.ink }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  action: {
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.sm + 4,
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 0,
    elevation: 3,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontFamily: fonts.pixel, fontSize: 12, flexShrink: 1 },
});
