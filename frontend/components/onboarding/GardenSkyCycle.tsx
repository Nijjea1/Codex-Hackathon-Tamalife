import React, { useEffect } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useUIStore } from "../../store/useUIStore";
import { useGardenClickSound } from "./GardenAmbience";

const RAYS = Array.from({ length: 8 }, (_, index) => index * 45);

export function GardenSkyCycle({ interactive = false }: { interactive?: boolean }) {
  const isDay = useUIStore((state) => state.onboardingTheme === "day");
  const setTheme = useUIStore((state) => state.setOnboardingTheme);
  const playClick = useGardenClickSound();
  const { height } = useWindowDimensions();
  const daylight = useSharedValue(isDay ? 1 : 0);
  const floating = useSharedValue(0);
  const travel = Math.max(390, height * 0.76);

  useEffect(() => {
    floating.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
      ),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
  }, [floating]);

  useEffect(() => {
    daylight.value = withTiming(isDay ? 1 : 0, { duration: 1650, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never });
  }, [daylight, isDay]);

  const sunMotion = useAnimatedStyle(() => ({
    opacity: 0.08 + daylight.value * 0.92,
    transform: [
      { translateX: (1 - daylight.value) * 105 },
      { translateY: (1 - daylight.value) * travel + floating.value * 5 },
      { scale: 0.72 + daylight.value * 0.28 + floating.value * 0.025 },
    ],
  }));

  const moonMotion = useAnimatedStyle(() => ({
    opacity: 1 - daylight.value * 0.92,
    transform: [
      { translateX: daylight.value * -105 },
      { translateY: daylight.value * travel + (1 - floating.value) * 5 },
      { rotate: `${-12 + daylight.value * -55}deg` },
      { scale: 1 - daylight.value * 0.28 },
    ],
  }));

  return (
    <View pointerEvents={interactive ? "box-none" : "none"} style={[styles.sky, interactive && styles.skyInteractive]}>
      <Animated.View style={[styles.body, styles.sunBody, sunMotion]}>
        <Pressable accessible={interactive} disabled={!interactive} accessibilityRole="switch" accessibilityLabel={interactive ? "Set garden to night" : undefined} onPress={() => { playClick(); setTheme("night"); }} style={styles.celestialPress}>
          {RAYS.map((rotation) => <View key={rotation} style={[styles.ray, { transform: [{ rotate: `${rotation}deg` }] }]} />)}
          <View style={styles.sunCore}><View style={styles.sunShine} /></View>
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.body, styles.moonBody, moonMotion]}>
        <Pressable accessible={interactive} disabled={!interactive} accessibilityRole="switch" accessibilityLabel={interactive ? "Set garden to day" : undefined} onPress={() => { playClick(); setTheme("day"); }} style={styles.celestialPress}>
          <View style={styles.moonDisc}>
            <View style={styles.moonCutout} />
            <View style={[styles.crater, styles.craterOne]} />
            <View style={[styles.crater, styles.craterTwo]} />
          </View>
          <View style={[styles.star, styles.starOne]} />
          <View style={[styles.star, styles.starTwo]} />
          <View style={[styles.star, styles.starThree]} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sky: { ...StyleSheet.absoluteFillObject, zIndex: 1, overflow: "hidden" },
  skyInteractive: { zIndex: 3 },
  body: { position: "absolute", right: "11%", top: "11%", width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  celestialPress: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  sunBody: {},
  ray: { position: "absolute", width: 6, height: 94, borderRadius: 1, backgroundColor: "rgba(205, 146, 62, 0.78)" },
  sunCore: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#dfb653", borderWidth: 4, borderColor: "#9d633c", alignItems: "flex-start", justifyContent: "flex-start", shadowColor: "#735039", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.45, shadowRadius: 0 },
  sunShine: { width: 15, height: 9, borderRadius: 2, backgroundColor: "rgba(249,229,153,0.7)", marginLeft: 9, marginTop: 9, transform: [{ rotate: "-28deg" }] },
  moonBody: {},
  moonDisc: { width: 62, height: 62, borderRadius: 25, overflow: "hidden", backgroundColor: "#d9d1a8", borderWidth: 4, borderColor: "#78678d", shadowColor: "#17162f", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.5, shadowRadius: 0 },
  moonCutout: { position: "absolute", width: 54, height: 54, borderRadius: 24, left: 21, top: -7, backgroundColor: "#282345" },
  crater: { position: "absolute", borderRadius: 2, backgroundColor: "rgba(151,137,148,0.46)" },
  craterOne: { width: 10, height: 10, left: 12, top: 17 },
  craterTwo: { width: 7, height: 7, left: 22, bottom: 12 },
  star: { position: "absolute", width: 6, height: 6, backgroundColor: "#dbc56d", transform: [{ rotate: "45deg" }] },
  starOne: { left: 2, top: 7 },
  starTwo: { right: 0, top: 24, width: 4, height: 4 },
  starThree: { right: 11, bottom: 0, width: 5, height: 5 },
});
