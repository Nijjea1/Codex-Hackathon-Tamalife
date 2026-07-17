import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { colors, fonts, radius } from "../../constants/theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
};

export function Button({ label, onPress, variant = "primary", disabled, loading, style, icon }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const inner = (
    <>
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : colors.primaryLight} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              variant === "ghost" && { color: colors.textSecondary },
              variant === "secondary" && { color: colors.primaryLight },
              variant === "danger" && { color: colors.danger },
            ]}
          >
            {label}
          </Text>
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        {variant === "primary" ? (
          <LinearGradient
            colors={disabled ? [colors.surfaceRaised, colors.surfaceRaised] : [colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.base, disabled && { opacity: 0.6 }]}
          >
            {inner}
          </LinearGradient>
        ) : (
          <Animated.View
            style={[
              styles.base,
              variant === "secondary" && styles.secondary,
              variant === "ghost" && styles.ghost,
              variant === "danger" && styles.dangerBtn,
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
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 22,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(139,124,255,0.35)",
  },
  ghost: { backgroundColor: "transparent" },
  dangerBtn: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: "rgba(240,106,120,0.35)",
  },
  label: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
});
