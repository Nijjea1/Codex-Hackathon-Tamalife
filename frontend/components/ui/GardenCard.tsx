import React from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  /** Softer look with no hard drop shadow. */
  flat?: boolean;
  /** Tighter padding. */
  compact?: boolean;
};

/**
 * Cream (day) / plum (night) "sticker" card with the garden's signature hard
 * pixel shadow. The core surface used across every revamped screen.
 */
export function GardenCard({
  children,
  style,
  onPress,
  onLongPress,
  accessibilityLabel,
  flat = false,
  compact = false,
}: Props) {
  const p = useGardenPalette();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const body = (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: p.cardBg,
          borderColor: p.cardBorder,
          padding: compact ? spacing.md : spacing.md + 2,
        },
        !flat && { shadowColor: p.cardShadow },
        !flat && styles.shadow,
        animated,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );

  if (!onPress && !onLongPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => (scale.value = withSpring(0.98, { damping: 16 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 16 }))}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 2.5,
  },
  shadow: {
    shadowOffset: { width: 4, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 5,
  },
});
