import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { colors, fonts, radius, spacing } from "../../constants/theme";
import { Creature } from "../creatures/Creature";

type Props = { hasSelection: boolean; message?: string };

// Small companion in the corner of every onboarding screen.
// Bounces whenever the user makes a selection.
export function CompanionReaction({ hasSelection, message }: Props) {
  const bounce = useSharedValue(0);

  useEffect(() => {
    if (hasSelection) {
      bounce.value = withSequence(
        withSpring(-12, { damping: 6, stiffness: 220 }),
        withSpring(0, { damping: 8 })
      );
    }
  }, [hasSelection, bounce]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value }],
  }));

  return (
    <View style={styles.row}>
      <Animated.View style={style}>
        <Creature species="sprout" mood={hasSelection ? "happy" : "healthy"} size="small" />
      </Animated.View>
      {message ? (
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderBottomLeftRadius: 4,
    padding: spacing.sm + 2,
  },
  bubbleText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
