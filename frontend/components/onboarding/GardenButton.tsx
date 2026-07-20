import * as Haptics from "expo-haptics";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useUIStore } from "../../store/useUIStore";
import { useGardenContinueSound } from "./GardenAmbience";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  icon?: React.ReactNode;
  style?: ViewStyle;
};

export function GardenButton({ label, onPress, disabled, loading, variant = "primary", icon, style }: Props) {
  const isDay = useUIStore((s) => s.onboardingTheme === "day");
  const playClick = useGardenContinueSound();
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[motion, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled || loading}
        onPressIn={() => (scale.value = withSpring(0.97, { damping: 16 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 16 }))}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          playClick();
          onPress();
        }}
        style={({ pressed }) => [styles.base, !isDay && styles.baseNight, variant === "secondary" && styles.secondary, variant === "secondary" && !isDay && styles.secondaryNight, disabled && styles.disabled, pressed && styles.pressed]}
      >
        {loading ? <ActivityIndicator color={variant === "primary" ? "#fffbe7" : "#31543c"} /> : icon}
        {!loading && <Text style={[styles.label, !isDay && styles.labelNight, variant === "secondary" && styles.secondaryLabel, variant === "secondary" && !isDay && styles.secondaryLabelNight]}>{label}</Text>}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 54, paddingHorizontal: 20, borderWidth: 3, borderColor: "#a8d98e", backgroundColor: "#3b8c64", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, shadowColor: "#24553f", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 5 },
  baseNight: { backgroundColor: "#745fd0", borderColor: "#c1b2ff", shadowColor: "#2b1d5c" },
  secondary: { backgroundColor: "#fff4c8", borderColor: "#71935f", shadowColor: "#7e7444" },
  secondaryNight: { backgroundColor: "#322653", borderColor: "#9584cc", shadowColor: "#151027" },
  label: { color: "#fffbe7", fontFamily: "monospace", fontWeight: "900", fontSize: 15, letterSpacing: 0.8 },
  labelNight: { color: "#fff7d8" },
  secondaryLabel: { color: "#31543c" },
  secondaryLabelNight: { color: "#eee8ff" },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 2 } },
});
