import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { fonts } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
};

/** Legacy Chip, garden-themed pill that fills gold-ish when selected. */
export function Chip({ label, selected, onPress, color }: Props) {
  const p = useGardenPalette();
  const activeBg = color ?? p.gold;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: p.pill, borderColor: p.pillBorder },
        selected && { backgroundColor: activeBg, borderColor: p.goldBorder },
      ]}
    >
      <Text style={[styles.label, { color: p.pillInk }, selected && { color: p.onGold }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 2,
  },
  label: { fontFamily: fonts.pixel, fontSize: 13, letterSpacing: 0.3 },
});
