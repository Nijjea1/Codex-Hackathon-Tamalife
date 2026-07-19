import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius } from "../../constants/theme";

type Props = {
  icon: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  badge?: boolean;
};

export function IconButton({ icon, onPress, accessibilityLabel, badge }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
      hitSlop={6}
    >
      {icon}
      {badge && <View style={styles.badge} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: colors.danger,
  },
});
