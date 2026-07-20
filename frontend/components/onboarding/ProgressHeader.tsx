import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { spacing } from "../../constants/theme";
import { useUIStore } from "../../store/useUIStore";
import { AmbienceButton, useGardenClickSound } from "./GardenAmbience";
import { GardenModeButton } from "./GardenModeButton";

type Props = { step: number; total: number };

export function ProgressHeader({ step, total }: Props) {
  const router = useRouter();
  const isDay = useUIStore((s) => s.onboardingTheme === "day");
  const playClick = useGardenClickSound();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(step / total, { damping: 18 });
  }, [step, total, progress]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => { playClick(); router.back(); }} style={({ pressed }) => [styles.back, !isDay && styles.backNight, pressed && { transform: [{ translateY: 2 }] }]}>
        <ChevronLeft size={22} color={isDay ? "#31543c" : "#f2eaff"} strokeWidth={3} />
      </Pressable>
      <View style={[styles.track, !isDay && styles.trackNight]} accessibilityLabel={`Step ${step} of ${total}`}>
        <Animated.View style={[styles.fill, !isDay && styles.fillNight, barStyle]} />
      </View>
      <Text style={[styles.count, !isDay && styles.countNight]}>{step} of {total}</Text>
      <AmbienceButton compact />
      <GardenModeButton compact />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  back: { width: 38, height: 38, borderRadius: 7, backgroundColor: "#fff3c4", borderWidth: 2, borderColor: "#66835a", alignItems: "center", justifyContent: "center", shadowColor: "#5e704a", shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.5, shadowRadius: 0 },
  backNight: { backgroundColor: "#322653", borderColor: "#9584cc", shadowColor: "#151027" },
  track: { flex: 1, height: 10, borderRadius: 4, borderWidth: 2, borderColor: "#66835a", backgroundColor: "#fff1c1", overflow: "hidden" },
  trackNight: { borderColor: "#9584cc", backgroundColor: "#30254f" },
  fill: { height: "100%", borderRadius: 2, backgroundColor: "#54a769" },
  fillNight: { backgroundColor: "#aa92ff" },
  count: { fontFamily: "monospace", fontWeight: "900", fontSize: 11, color: "#31543c" },
  countNight: { color: "#eee7ff" },
});
