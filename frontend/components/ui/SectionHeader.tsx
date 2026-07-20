import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";

type Props = { title: string; actionLabel?: string; onAction?: () => void };

/** Legacy SectionHeader, garden-themed with the pixel display font. */
export function SectionHeader({ title, actionLabel, onAction }: Props) {
  const p = useGardenPalette();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: p.ink }]}>{title}</Text>
      {actionLabel ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={[styles.action, { color: p.accent }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.sm + 4,
  },
  title: { fontFamily: fonts.pixelBold, fontSize: 17, letterSpacing: 0.5 },
  action: { fontFamily: fonts.pixel, fontSize: 12, letterSpacing: 0.5 },
});
