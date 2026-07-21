import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useGardenPalette } from "../../constants/garden";
import { radius } from "../../constants/theme";
import { CreatureMood } from "../../types/subscription";

type Props = {
  mood: CreatureMood;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function CreatureHabitat({ mood, children, style }: Props) {
  const palette = useGardenPalette();
  const moodColor =
    mood === "critical" || mood === "sick"
      ? palette.dangerBg
      : mood === "concerned"
        ? palette.warningBg
        : palette.successBg;

  return (
    <LinearGradient
      colors={[palette.cardBgSolid, moodColor]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[styles.habitat, { borderColor: palette.cardBorder }, style]}
    >
      <View style={[styles.blob, { backgroundColor: palette.accent, top: -30, left: -20 }]} />
      <View style={[styles.blob, { backgroundColor: palette.leaf, bottom: -40, right: -10 }]} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  habitat: {
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
  },
  blob: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 140,
    opacity: 0.07,
  },
});
