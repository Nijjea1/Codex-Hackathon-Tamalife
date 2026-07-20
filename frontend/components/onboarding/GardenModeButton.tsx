import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useUIStore } from "../../store/useUIStore";
import { useGardenClickSound } from "./GardenAmbience";

export function GardenModeButton({ compact = false }: { compact?: boolean }) {
  const theme = useUIStore((s) => s.onboardingTheme);
  const setTheme = useUIStore((s) => s.setOnboardingTheme);
  const playClick = useGardenClickSound();
  const isDay = theme === "day";
  const daylight = useSharedValue(isDay ? 1 : 0);

  useEffect(() => {
    daylight.value = withTiming(isDay ? 1 : 0, { duration: 950, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never });
  }, [daylight, isDay]);

  const sunStyle = useAnimatedStyle(() => ({ opacity: daylight.value, transform: [{ translateY: (1 - daylight.value) * 27 }, { rotate: `${(1 - daylight.value) * 90}deg` }] }));
  const moonStyle = useAnimatedStyle(() => ({ opacity: 1 - daylight.value, transform: [{ translateY: daylight.value * 27 }, { rotate: `${daylight.value * -70}deg` }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: isDay }}
      accessibilityLabel={`Switch to ${isDay ? "night" : "day"} mode`}
      onPress={() => {
        playClick();
        setTheme(isDay ? "night" : "day");
      }}
      style={({ pressed }) => [styles.button, !isDay && styles.buttonNight, compact && styles.compact, pressed && styles.pressed]}
    >
      <View style={styles.orbit}>
        <Animated.Text style={[styles.icon, styles.sun, sunStyle]}>{"\u2600"}</Animated.Text>
        <Animated.Text style={[styles.icon, styles.moon, moonStyle]}>{"\u263E"}</Animated.Text>
        <View style={[styles.horizon, !isDay && styles.horizonNight]} />
      </View>
      {!compact && <Text style={[styles.label, !isDay && styles.labelNight]}>{isDay ? "DAY" : "NIGHT"}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: 38, minWidth: 82, paddingHorizontal: 7, borderRadius: 19, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,248,209,0.95)", borderWidth: 2, borderColor: "#568b61", overflow: "hidden" },
  buttonNight: { backgroundColor: "rgba(42,27,75,0.94)", borderColor: "#a99ae9" },
  compact: { minWidth: 38, width: 38, paddingHorizontal: 2 },
  pressed: { transform: [{ translateY: 2 }] },
  orbit: { width: 28, height: 29, overflow: "hidden", alignItems: "center" },
  icon: { position: "absolute", top: 0, fontSize: 20, lineHeight: 25, fontWeight: "900" },
  sun: { color: "#e8a025" },
  moon: { color: "#e9e1ff" },
  horizon: { position: "absolute", bottom: 2, width: 26, height: 2, borderRadius: 2, backgroundColor: "#7aa064" },
  horizonNight: { backgroundColor: "#7566a5" },
  label: { color: "#31543c", fontFamily: "monospace", fontWeight: "900", fontSize: 9 },
  labelNight: { color: "#eee8ff" },
});
