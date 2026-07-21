import React, { useEffect } from "react";
import { Image, ImageSourcePropType, StyleSheet, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useUIStore } from "../../store/useUIStore";

const sheet = require("../../assets/onboarding-mascot-sheet.png") as ImageSourcePropType;

export const mascotOptions = [
  { id: "penny", name: "Penny", role: "The cheerful saver", personality: "A warm little piggy bank who keeps every coin safe.", cell: [0, 0] },
  { id: "mochi", name: "Mochi", role: "The calm planner", personality: "A cozy calendar cat who keeps every date manageable.", cell: [1, 0] },
  { id: "twinkle", name: "Twinkle", role: "The bright motivator", personality: "A golden star who celebrates every money win.", cell: [0, 1] },
  { id: "bucky", name: "Bucky", role: "The careful keeper", personality: "A practical coin pouch who makes saving feel simple.", cell: [1, 1] },
  { id: "rolo", name: "Rolo", role: "The clever spotter", personality: "A curious raccoon who finds charges hiding in plain sight.", cell: [0, 2] },
  { id: "sunny", name: "Sunny", role: "The happy helper", personality: "A cheerful chick who keeps your money garden bright.", cell: [1, 2] },
] as const;

export type MascotId = (typeof mascotOptions)[number]["id"];

export function MascotPortrait({ id, size }: { id: string; size: number }) {
  const reducedMotion = useUIStore((state) => state.reducedMotion);
  const mascot = mascotOptions.find((item) => item.id === id) ?? mascotOptions[0];
  const [column, row] = mascot.cell;
  const idle = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      idle.value = 0;
      return;
    }
    idle.value = withRepeat(
      withSequence(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }), withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never })),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [idle, reducedMotion]);

  const idleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reducedMotion ? 0 : -4 - idle.value * 8 },
      { rotate: `${reducedMotion ? 0 : -1.5 + idle.value * 3}deg` },
      { scale: reducedMotion ? 1 : 1.055 + idle.value * 0.022 },
    ],
  }));
  return (
    <View style={[styles.crop, { width: size, height: size }]} accessibilityRole="image" accessibilityLabel={`${mascot.name}, ${mascot.role}`}>
      <Animated.View style={[{ width: size, height: size }, idleStyle]}>
        <Image source={sheet} resizeMode="stretch" style={{ position: "absolute", width: size * 2, height: size * 3, left: -column * size, top: -row * size }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  crop: { overflow: "hidden", backgroundColor: "#dfe8a5" },
});
