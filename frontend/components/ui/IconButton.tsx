import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useGardenPalette } from "../../constants/garden";

type Props = {
  icon: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  badge?: boolean;
};

/** Legacy IconButton, garden-themed as a cream/plum pill. */
export function IconButton({ icon, onPress, accessibilityLabel, badge }: Props) {
  const p = useGardenPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: p.pill, borderColor: p.pillBorder },
        pressed && { transform: [{ translateY: 2 }] },
      ]}
      hitSlop={6}
    >
      {icon}
      {badge && <View style={[styles.badge, { borderColor: p.pill }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: "#e5533f",
  },
});
