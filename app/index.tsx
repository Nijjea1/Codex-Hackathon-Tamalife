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
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from "react-native-svg";
import { colors, fonts, spacing } from "../constants/theme";
import { useUIStore } from "../store/useUIStore";

// Launch screen: the Tamalife seed-egg drops in, squashes, rebounds, floats,
// and glows — then auto-advances to the welcome screen.
export default function LaunchScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  const drop = useSharedValue(-260);
  const squash = useSharedValue(1);
  const float = useSharedValue(0);
  const glow = useSharedValue(0.4);
  const shadowScale = useSharedValue(0.2);
  const wordmark = useSharedValue(0);
  const leaf = useSharedValue(0);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      router.replace("/(tabs)/home");
      return;
    }
    if (reducedMotion) {
      drop.value = 0;
      shadowScale.value = 1;
      wordmark.value = withTiming(1, { duration: 400 });
      const t = setTimeout(() => router.replace("/(auth)/welcome"), 1400);
      return () => clearTimeout(t);
    }
    shadowScale.value = withTiming(1, { duration: 500 });
    drop.value = withDelay(
      150,
      withTiming(0, { duration: 550, easing: Easing.in(Easing.quad) })
    );
    squash.value = withDelay(
      700,
      withSequence(
        withTiming(0.82, { duration: 110 }),
        withSpring(1, { damping: 5, stiffness: 160 })
      )
    );
    float.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
    glow.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
    leaf.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
    wordmark.value = withDelay(1000, withTiming(1, { duration: 600 }));
    const t = setTimeout(() => router.replace("/(auth)/welcome"), 2600);
    return () => clearTimeout(t);
  }, [
    isLoaded,
    isSignedIn,
    reducedMotion,
    router,
    drop,
    squash,
    float,
    glow,
    shadowScale,
    wordmark,
    leaf,
  ]);

  const eggStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: drop.value + float.value },
      { scaleY: squash.value },
      { scaleX: 1 + (1 - squash.value) * 0.6 },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: shadowScale.value * (1 - float.value * -0.01) }],
    opacity: 0.35 + float.value * 0.01,
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmark.value,
    transform: [{ translateY: (1 - wordmark.value) * 16 }],
  }));
  const leafStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${leaf.value * 12 - 6}deg` }],
  }));

  return (
    <View style={styles.root}>
      <View style={[styles.ambient, { top: "12%", left: -60, backgroundColor: colors.primary }]} />
      <View style={[styles.ambient, { bottom: "18%", right: -70, backgroundColor: colors.secondary }]} />

      <View style={styles.center}>
        <Animated.View style={eggStyle}>
          <Animated.View style={[styles.leafWrap, leafStyle]}>
            <Svg width={34} height={34} viewBox="0 0 34 34">
              <Path
                d="M17 30 C17 30 8 22 11 12 C13 6 17 4 17 4 C17 4 21 6 23 12 C26 22 17 30 17 30 Z"
                fill={colors.secondary}
              />
            </Svg>
          </Animated.View>
          <Svg width={150} height={170} viewBox="0 0 150 170">
            <Defs>
              <RadialGradient id="egg" cx="38%" cy="28%" r="85%">
                <Stop offset="0%" stopColor="#2E3358" />
                <Stop offset="60%" stopColor="#1E2240" />
                <Stop offset="100%" stopColor="#141731" />
              </RadialGradient>
              <RadialGradient id="heart" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={colors.primaryLight} stopOpacity="1" />
                <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Path
              d="M75 8 C108 8 130 55 130 95 C130 133 106 158 75 158 C44 158 20 133 20 95 C20 55 42 8 75 8 Z"
              fill="url(#egg)"
            />
            <Ellipse cx="55" cy="42" rx="14" ry="9" fill="#3A4070" opacity={0.85} />
          </Svg>
          <Animated.View style={[styles.glow, glowStyle]}>
            <Svg width={90} height={90} viewBox="0 0 90 90">
              <Defs>
                <RadialGradient id="pulse" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={colors.primaryLight} stopOpacity="0.9" />
                  <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Ellipse cx="45" cy="45" rx="45" ry="45" fill="url(#pulse)" />
            </Svg>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.groundShadow, shadowStyle]} />

        <Animated.View style={[wordmarkStyle, { alignItems: "center" }]}>
          <Text style={styles.wordmark}>Tamalife</Text>
          <Text style={styles.tagline}>Keep your expenses alive.</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(600)} style={styles.skipWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip animation"
          onPress={() => router.replace("/(auth)/welcome")}
          hitSlop={12}
        >
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  ambient: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 240,
    opacity: 0.07,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  leafWrap: { position: "absolute", top: -18, alignSelf: "center", zIndex: 2 },
  glow: { position: "absolute", top: 55, alignSelf: "center" },
  groundShadow: {
    width: 110,
    height: 20,
    borderRadius: 110,
    backgroundColor: "#000",
    marginTop: 6,
    marginBottom: spacing.xl,
  },
  wordmark: {
    fontFamily: fonts.extraBold,
    fontSize: 40,
    color: colors.text,
    letterSpacing: 0.5,
  },
  tagline: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  skipWrap: { position: "absolute", bottom: 60, alignSelf: "center" },
  skip: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textMuted },
});
