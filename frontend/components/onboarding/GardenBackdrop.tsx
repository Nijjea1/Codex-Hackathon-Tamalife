import React, { useEffect } from "react";
import { ImageSourcePropType, StyleSheet, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useUIStore } from "../../store/useUIStore";
import { GardenSkyCycle } from "./GardenSkyCycle";

const dayGarden = require("../../assets/onboarding-garden-day-bg.png") as ImageSourcePropType;
const nightGarden = require("../../assets/onboarding-garden-bg.png") as ImageSourcePropType;

export function GardenBackdrop({ strongerShade = false, hideSky = false }: { strongerShade?: boolean; hideSky?: boolean }) {
  const isDay = useUIStore((s) => s.onboardingTheme === "day");
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const breeze = useSharedValue(0);
  const daylight = useSharedValue(isDay ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      breeze.value = 0;
      return;
    }
    breeze.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        withTiming(0, { duration: 4200, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [breeze, reducedMotion]);

  useEffect(() => {
    daylight.value = withTiming(isDay ? 1 : 0, {
      duration: 800,
      easing: Easing.inOut(Easing.quad),
      reduceMotion: reducedMotion ? ReduceMotion.Always : ReduceMotion.Never,
    });
  }, [daylight, isDay, reducedMotion]);

  const gardenMotion = useAnimatedStyle(() => ({
    transform: [
      { scale: reducedMotion ? 1 : 1.055 + breeze.value * 0.025 },
      { translateX: reducedMotion ? 0 : -10 + breeze.value * 20 },
      { translateY: reducedMotion ? 0 : -4 + breeze.value * 8 },
      { rotate: `${reducedMotion ? 0 : -0.18 + breeze.value * 0.36}deg` },
    ],
  }));
  const dayVisibility = useAnimatedStyle(() => ({ opacity: daylight.value }));
  const nightVisibility = useAnimatedStyle(() => ({ opacity: 1 - daylight.value }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.Image source={nightGarden} resizeMode="cover" style={[styles.image, gardenMotion, nightVisibility]} />
      <Animated.Image source={dayGarden} resizeMode="cover" style={[styles.image, gardenMotion, dayVisibility]} />
      {!hideSky && <GardenSkyCycle />}
      <View style={[styles.shade, !isDay && styles.shadeNight, strongerShade && (isDay ? styles.strongerShade : styles.strongerShadeNight)]} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { ...StyleSheet.absoluteFillObject, width: "110%", height: "110%", left: "-5%", top: "-5%" },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255, 249, 218, 0.18)" },
  shadeNight: { backgroundColor: "rgba(12, 9, 34, 0.4)" },
  strongerShade: { backgroundColor: "rgba(248, 245, 213, 0.34)" },
  strongerShadeNight: { backgroundColor: "rgba(12, 9, 34, 0.56)" },
});
