import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { fonts } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { useGardenContinueSound } from "../onboarding/GardenAmbience";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
};

/**
 * Legacy Button, garden-themed: gold "sticker" gradient for primary, cream/plum
 * pill for secondary, matching the onboarding GardenButton language.
 */
export function Button({ label, onPress, variant = "primary", disabled, loading, style, icon }: Props) {
  const p = useGardenPalette();
  const playContinue = useGardenContinueSound();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const labelColor =
    variant === "primary"
      ? p.onGold
      : variant === "danger"
      ? p.danger
      : variant === "ghost"
      ? p.body
      : p.pillInk;

  const inner = (
    <>
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? p.onGold : p.pillInk} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        </>
      )}
    </>
  );

  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled || loading}
        onPressIn={() => (scale.value = withSpring(0.96, { damping: 15 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 15 }))}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          playContinue();
          onPress();
        }}
      >
        {variant === "primary" ? (
          <LinearGradient
            colors={disabled ? [p.pill, p.pill] : [p.goldLight, p.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.base, styles.primary, { borderColor: p.goldBorder }, disabled && { opacity: 0.6 }]}
          >
            {inner}
          </LinearGradient>
        ) : (
          <Animated.View
            style={[
              styles.base,
              variant === "secondary" && { backgroundColor: p.pill, borderWidth: 2, borderColor: p.pillBorder },
              variant === "ghost" && { backgroundColor: "transparent" },
              variant === "danger" && { backgroundColor: p.dangerBg, borderWidth: 2, borderColor: p.danger },
              disabled && { opacity: 0.5 },
            ]}
          >
            {inner}
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 22,
  },
  primary: {
    borderWidth: 2,
    shadowColor: "#F4B942",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: { fontFamily: fonts.pixelBold, fontSize: 15, letterSpacing: 1 },
});
