import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { fonts, spacing } from "../../constants/theme";
import { useUIStore } from "../../store/useUIStore";
import { PennyPiggy } from "./PennyPiggy";

type Props = { hasSelection: boolean; message?: string };

export function CompanionReaction({ hasSelection, message }: Props) {
  const isDay = useUIStore((s) => s.onboardingTheme === "day");
  const bounce = useSharedValue(0);

  useEffect(() => {
    if (hasSelection) bounce.value = withSequence(withSpring(-12, { damping: 6, stiffness: 220 }), withSpring(0, { damping: 8 }));
  }, [hasSelection, bounce]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: bounce.value }] }));

  return (
    <View style={styles.row}>
      <Animated.View style={style}>
        <PennyPiggy isDay={isDay} size={72} />
      </Animated.View>
      {message ? (
        <View style={[styles.bubble, !isDay && styles.bubbleNight]}>
          <Text style={[styles.bubbleText, !isDay && styles.bubbleTextNight]}>{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bubble: { flex: 1, backgroundColor: "#fff4c8", borderWidth: 3, borderColor: "#4f7b55", borderRadius: 9, borderBottomLeftRadius: 4, padding: spacing.sm + 2, shadowColor: "#587245", shadowOffset: { width: 3, height: 4 }, shadowOpacity: 0.6, shadowRadius: 0 },
  bubbleNight: { backgroundColor: "#322653", borderColor: "#9b8ad6", shadowColor: "#120d27" },
  bubbleText: { fontFamily: fonts.medium, fontSize: 12, color: "#465a42" },
  bubbleTextNight: { color: "#e0d7f2" },
});
