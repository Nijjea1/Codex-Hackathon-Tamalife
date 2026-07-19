import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius } from "../../constants/theme";
import { CreatureMood } from "../../types/subscription";

type Props = {
  mood: CreatureMood;
  children: React.ReactNode;
  style?: ViewStyle;
};

const moodGradients: Record<CreatureMood, [string, string]> = {
  happy: ["#1B2340", "#12321F"],
  healthy: ["#1B2340", "#12302C"],
  concerned: ["#1F2138", "#33290F"],
  sick: ["#1A1B28", "#2E1A20"],
  critical: ["#16151F", "#2B141C"],
  reviving: ["#1F2145", "#232B4F"],
  resolved: ["#1E2142", "#26204A"],
};

// Environment behind a creature. Darkens as health worsens.
export function CreatureHabitat({ mood, children, style }: Props) {
  return (
    <LinearGradient
      colors={moodGradients[mood]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[styles.habitat, style]}
    >
      <View style={[styles.blob, { backgroundColor: colors.primary, top: -30, left: -20 }]} />
      <View style={[styles.blob, { backgroundColor: colors.secondary, bottom: -40, right: -10 }]} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  habitat: {
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  blob: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 140,
    opacity: 0.07,
  },
});
