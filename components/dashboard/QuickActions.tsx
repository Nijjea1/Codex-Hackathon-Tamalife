import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ClipboardPaste, Plus, Sparkles, TrendingUp } from "lucide-react-native";
import { colors, fonts, radius, spacing } from "../../constants/theme";

type Props = {
  onAdd: () => void;
  onPaste: () => void;
  onPriceChanges: () => void;
  onViewAll: () => void;
};

export function QuickActions({ onAdd, onPaste, onPriceChanges, onViewAll }: Props) {
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
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.75 }]}
        >
          <View style={styles.iconWrap}>
            <Icon size={18} color={colors.primaryLight} />
          </View>
          <Text style={styles.label}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  action: {
    flexBasis: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text, flexShrink: 1 },
});
