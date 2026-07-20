import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { MascotPortrait } from "../onboarding/MascotPortrait";
import { Button } from "./Button";

type Props = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Which mascot to show (default penny). */
  mascot?: string;
};

/** Garden-themed empty state with a friendly mascot. */
export function EmptyState({ title, message, actionLabel, onAction, mascot = "penny" }: Props) {
  const p = useGardenPalette();
  return (
    <View style={styles.wrap}>
      <MascotPortrait id={mascot} size={108} />
      <Text style={[styles.title, { color: p.ink }]}>{title}</Text>
      <Text style={[styles.message, { color: p.body }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontFamily: fonts.pixelBold,
    fontSize: 18,
    marginTop: spacing.md,
    textAlign: "center",
  },
  message: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },
});
