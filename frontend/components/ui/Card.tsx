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
  raised?: boolean;
  accessibilityLabel?: string;
};

/** Legacy Card, garden-themed: cream/plum sticker card with a hard shadow. */
export function Card({ children, style, onPress, onLongPress, raised, accessibilityLabel }: Props) {
  const p = useGardenPalette();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const body = (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: raised ? p.cardBgSolid : p.cardBg,
          borderColor: p.cardBorder,
          shadowColor: p.cardShadow,
        },
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
    padding: spacing.md,
    shadowOffset: { width: 4, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 5,
  },
});
