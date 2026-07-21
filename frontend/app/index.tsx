import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, spacing } from "../constants/theme";
import { useGardenPalette } from "../constants/garden";
import { GardenBackdrop } from "../components/onboarding/GardenBackdrop";
import { PennyPiggy } from "../components/onboarding/PennyPiggy";
import { useUIStore } from "../store/useUIStore";
import { useDemoModeStore } from "../store/useDemoModeStore";

// Launch screen: the same cozy garden scene and Penny that greet you on the
// welcome screen fade in with the Tamalife wordmark, then auto-advance.
export default function LaunchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const demoMode = useDemoModeStore((s) => s.active);
  const palette = useGardenPalette();
  const isDay = palette.isDay;
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  const wordmark = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn || demoMode) {
      router.replace("/(tabs)/home");
      return;
    }
    if (reducedMotion) {
      wordmark.value = withTiming(1, { duration: 400 });
      const t = setTimeout(() => router.replace("/(auth)/welcome"), 1400);
      return () => clearTimeout(t);
    }
    wordmark.value = withDelay(300, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    float.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    const t = setTimeout(() => router.replace("/(auth)/welcome"), 2600);
    return () => clearTimeout(t);
  }, [isLoaded, isSignedIn, demoMode, reducedMotion, router, wordmark, float]);

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmark.value,
    transform: [{ translateY: (1 - wordmark.value) * 18 + float.value }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: palette.bgDeep }]}>
      <GardenBackdrop hideSky />
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Animated.View style={[styles.hero, wordmarkStyle]}>
          <View style={styles.pennyWrap}>
            <PennyPiggy isDay={isDay} size={170} />
          </View>
          <Text style={[styles.wordmark, isDay && styles.wordmarkDay]}>TAMALIFE</Text>
          <Text style={[styles.tagline, isDay && styles.taglineDay]}>Keep your expenses alive.</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(700)} style={[styles.skipWrap, { bottom: insets.bottom + spacing.xl }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip animation"
          onPress={() => router.replace("/(auth)/welcome")}
          hitSlop={12}
        >
          <Text style={[styles.skip, isDay && styles.skipDay]}>Skip</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { alignItems: "center" },
  pennyWrap: { marginBottom: spacing.md },
  wordmark: {
    fontFamily: fonts.pixelBold,
    fontSize: 34,
    color: "#fff7d8",
    letterSpacing: 2,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 5,
  },
  wordmarkDay: { color: "#122a1a", textShadowColor: "rgba(255,255,255,0.8)" },
  tagline: {
    fontFamily: fonts.pixel,
    fontSize: 13,
    color: "#E4E1F2",
    marginTop: spacing.sm,
    letterSpacing: 0.5,
  },
  taglineDay: { color: "#1c3a26" },
  skipWrap: { position: "absolute", alignSelf: "center" },
  skip: { fontFamily: fonts.pixel, fontSize: 12, color: "#E4E1F2", letterSpacing: 1 },
  skipDay: { color: "#1c3a26" },
});
