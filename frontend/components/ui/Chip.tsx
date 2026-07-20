import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fonts, radius } from "../../constants/theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
};

export function Chip({ label, selected, onPress, color = colors.primary }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: color, borderColor: color },
      ]}
    >
      <Text style={[styles.label, selected && { color: "#0D0F1C" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textSecondary },
});
