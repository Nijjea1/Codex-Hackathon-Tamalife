import React from "react";
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { fonts } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";

/** Small monospace/pixel "eyebrow" label, e.g. SAVE POINT, TODAY'S GARDEN. */
export function GardenKicker({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const p = useGardenPalette();
  return <Text style={[styles.kicker, { color: p.accent }, style]}>{children}</Text>;
}

/** Pixel section title with an optional right-aligned action link. */
export function GardenSectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}) {
  const p = useGardenPalette();
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={[styles.sectionTitle, { color: p.ink }]}>{title}</Text>
      {actionLabel ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={[styles.action, { color: p.accent }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Rounded status pill (tone-aware). */
export function GardenPill({
  label,
  tone = "neutral",
  style,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  style?: ViewStyle;
}) {
  const p = useGardenPalette();
  const bg =
    tone === "success" ? p.successBg : tone === "warning" ? p.warningBg : tone === "danger" ? p.dangerBg : p.pill;
  const ink =
    tone === "success" ? p.success : tone === "warning" ? p.warning : tone === "danger" ? p.danger : p.pillInk;
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: ink }, style]}>
      <Text style={[styles.pillText, { color: ink }]}>{label}</Text>
    </View>
  );
}

/** A labelled numeric stat used in summary rows. */
export function GardenStat({
  label,
  value,
  hint,
  align = "flex-start",
}: {
  label: string;
  value: string;
  hint?: string;
  align?: "flex-start" | "center" | "flex-end";
}) {
  const p = useGardenPalette();
  return (
    <View style={{ alignItems: align, gap: 2 }}>
      <Text style={[styles.statLabel, { color: p.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: p.inkStrong }]}>{value}</Text>
      {hint ? <Text style={[styles.statHint, { color: p.body }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: "monospace", fontWeight: "900", fontSize: 10, letterSpacing: 1.5 },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: fonts.pixelBold, fontSize: 17, letterSpacing: 0.5 },
  action: { fontFamily: fonts.pixel, fontSize: 12, letterSpacing: 0.5 },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    alignSelf: "flex-start",
  },
  pillText: { fontFamily: "monospace", fontWeight: "900", fontSize: 10, letterSpacing: 0.5 },
  statLabel: { fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.5 },
  statValue: { fontFamily: fonts.pixelBold, fontSize: 22 },
  statHint: { fontFamily: fonts.medium, fontSize: 11 },
});
