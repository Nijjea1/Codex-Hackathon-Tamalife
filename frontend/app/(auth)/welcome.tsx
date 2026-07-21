import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronRight, Moon, Sun } from "lucide-react-native";
import React, { useEffect } from "react";
import { ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Circle, Defs, RadialGradient, Stop, Svg } from "react-native-svg";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { useUIStore } from "../../store/useUIStore";
import { AmbienceButton, useGardenAmbienceFadeOut, useGardenClickSound, useGardenContinueSound } from "../../components/onboarding/GardenAmbience";
import { PennyPiggy } from "../../components/onboarding/PennyPiggy";
import { demoModeAvailable } from "../../lib/config";
import { useDemoModeStore } from "../../store/useDemoModeStore";

const nightGardenBackground = require("../../assets/onboarding-garden-bg.png") as ImageSourcePropType;
const dayGardenBackground = require("../../assets/onboarding-garden-day-bg.png") as ImageSourcePropType;

function GardenBackdrop({ isDay }: { isDay: boolean }) {
  const motion = useSharedValue(0);
  const daylight = useSharedValue(isDay ? 1 : 0);

  useEffect(() => {
    motion.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        withTiming(0, { duration: 4600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [motion]);

  useEffect(() => {
    daylight.value = withTiming(isDay ? 1 : 0, { duration: 850, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never });
  }, [daylight, isDay]);

  const gardenMotion = useAnimatedStyle(() => ({
    transform: [
      { scale: 1.055 + motion.value * 0.025 },
      { translateX: -10 + motion.value * 20 },
      { translateY: -4 + motion.value * 8 },
    ],
  }));
  const nightVisibility = useAnimatedStyle(() => ({ opacity: 1 - daylight.value }));
  const dayVisibility = useAnimatedStyle(() => ({ opacity: daylight.value }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.Image source={nightGardenBackground} resizeMode="cover" style={[styles.gardenBackground, gardenMotion, nightVisibility]} />
      <Animated.Image source={dayGardenBackground} resizeMode="cover" style={[styles.gardenBackground, gardenMotion, dayVisibility]} />
    </View>
  );
}

function GardenAtmosphere({ isDay }: { isDay: boolean }) {
  const flame = useSharedValue(0.35);
  const breeze = useSharedValue(0);
  const firefly = useSharedValue(0);
  const daylight = useSharedValue(isDay ? 1 : 0);

  useEffect(() => {
    flame.value = withRepeat(
      withSequence(withTiming(0.74, { duration: 520, reduceMotion: ReduceMotion.Never }), withTiming(0.38, { duration: 390, reduceMotion: ReduceMotion.Never })),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
    breeze.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
    firefly.value = withRepeat(
      withSequence(withTiming(1, { duration: 1800, reduceMotion: ReduceMotion.Never }), withTiming(0.15, { duration: 1400, reduceMotion: ReduceMotion.Never })),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
  }, [breeze, firefly, flame]);

  useEffect(() => {
    daylight.value = withTiming(isDay ? 1 : 0, { duration: 700, reduceMotion: ReduceMotion.Never });
  }, [daylight, isDay]);

  const lanternGlow = useAnimatedStyle(() => ({
    opacity: flame.value * (1 - daylight.value),
    transform: [{ scale: 0.8 + flame.value * 0.42 }],
  }));
  const driftingLeaf = useAnimatedStyle(() => ({
    opacity: 0.38 + breeze.value * 0.48,
    transform: [
      { translateX: -18 + breeze.value * 84 },
      { translateY: breeze.value * 25 },
      { rotate: `${-28 + breeze.value * 72}deg` },
    ],
  }));
  const driftingLeafSecond = useAnimatedStyle(() => ({
    opacity: 0.34 + (1 - breeze.value) * 0.46,
    transform: [
      { translateX: 28 - breeze.value * 82 },
      { translateY: (1 - breeze.value) * 24 },
      { rotate: `${32 - breeze.value * 72}deg` },
    ],
  }));
  const fireflyStyle = useAnimatedStyle(() => ({
    opacity: firefly.value * (1 - daylight.value),
    transform: [{ translateY: -5 + firefly.value * 10 }, { scale: 0.7 + firefly.value * 0.5 }],
  }));
  const sunlightStyle = useAnimatedStyle(() => ({
    opacity: daylight.value * (0.14 + breeze.value * 0.08),
    transform: [{ translateX: -12 + breeze.value * 24 }, { rotate: "-15deg" }],
  }));
  const pollenStyle = useAnimatedStyle(() => ({
    opacity: daylight.value * (0.35 + firefly.value * 0.35),
    transform: [{ translateX: breeze.value * 24 }, { translateY: -6 + firefly.value * 12 }],
  }));

  return (
    <View pointerEvents="none" style={styles.atmosphere}>
      <Animated.View style={[styles.lanternGlow, styles.lanternOne, lanternGlow]} />
      <Animated.View style={[styles.lanternGlow, styles.lanternTwo, lanternGlow]} />
      <Animated.View style={[styles.welcomeFlame, styles.welcomeFlameOne, lanternGlow]} />
      <Animated.View style={[styles.welcomeFlame, styles.welcomeFlameTwo, lanternGlow]} />
      <Animated.Text style={[styles.windLeaf, styles.windLeafOne, driftingLeaf]}>{"\u25C6"}</Animated.Text>
      <Animated.Text style={[styles.windLeaf, styles.windLeafTwo, driftingLeafSecond]}>{"\u25C6"}</Animated.Text>
      <Animated.View style={[styles.firefly, styles.fireflyOne, fireflyStyle]} />
      <Animated.View style={[styles.firefly, styles.fireflyTwo, fireflyStyle]} />
      <Animated.View style={[styles.firefly, styles.fireflyThree, fireflyStyle]} />
      <Animated.View style={[styles.sunbeam, sunlightStyle]} />
      <Animated.View style={[styles.pollen, styles.pollenOne, pollenStyle]} />
      <Animated.View style={[styles.pollen, styles.pollenTwo, pollenStyle]} />
      <Animated.View style={[styles.pollen, styles.pollenThree, pollenStyle]} />
    </View>
  );
}

function GlowSun() {
  return (
    <Svg width={190} height={190} viewBox="0 0 72 72">
      <Defs>
        <RadialGradient id="welcomeSunCore" cx="50%" cy="45%" r="55%">
          <Stop offset="0%" stopColor="#FFF3C4" />
          <Stop offset="60%" stopColor="#FFD25A" />
          <Stop offset="100%" stopColor="#F7A83C" />
        </RadialGradient>
        <RadialGradient id="welcomeSunGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFD98A" stopOpacity={0.6} />
          <Stop offset="100%" stopColor="#FFD98A" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={36} cy={36} r={34} fill="url(#welcomeSunGlow)" />
      <Circle cx={36} cy={36} r={18} fill="url(#welcomeSunCore)" />
    </Svg>
  );
}

function GlowMoon() {
  return (
    <Svg width={150} height={150} viewBox="0 0 64 64">
      <Defs>
        <RadialGradient id="welcomeMoonCore" cx="42%" cy="40%" r="65%">
          <Stop offset="0%" stopColor="#F4F1FF" />
          <Stop offset="100%" stopColor="#C7C3E8" />
        </RadialGradient>
        <RadialGradient id="welcomeMoonGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#CFE0FF" stopOpacity={0.5} />
          <Stop offset="100%" stopColor="#CFE0FF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={32} cy={32} r={30} fill="url(#welcomeMoonGlow)" />
      <Circle cx={32} cy={32} r={16} fill="url(#welcomeMoonCore)" />
      <Circle cx={27} cy={28} r={3} fill="#B9B4DE" opacity={0.6} />
      <Circle cx={37} cy={34} r={2.2} fill="#B9B4DE" opacity={0.5} />
      <Circle cx={30} cy={38} r={1.6} fill="#B9B4DE" opacity={0.5} />
    </Svg>
  );
}

// Soft glowing sun and moon that arc across the top-right corner as the
// scene crossfades between day and night — purely decorative; the coin
// toggle below is what actually switches the mode.
function CelestialSky({ isDay, topOffset }: { isDay: boolean; topOffset: number }) {
  const daylight = useSharedValue(isDay ? 1 : 0);
  const floating = useSharedValue(0);

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
    daylight.value = withTiming(isDay ? 1 : 0, { duration: 1100, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never });
  }, [daylight, isDay]);

  // Both orbs stay put in the top-right corner — only a gentle idle bob and a
  // crossfade signal the day/night change, no rising-and-setting arc.
  const sunStyle = useAnimatedStyle(() => ({
    opacity: 0.08 + daylight.value * 0.92,
    transform: [{ translateY: floating.value * 4 }, { scale: 0.72 + daylight.value * 0.28 }],
  }));
  const moonStyle = useAnimatedStyle(() => ({
    opacity: 1 - daylight.value * 0.92,
    transform: [{ translateY: (1 - floating.value) * 4 }, { scale: 1 - daylight.value * 0.28 }],
  }));

  return (
    <View pointerEvents="none" style={styles.celestialSky}>
      <View style={[styles.celestialBody, { top: topOffset + 58 }]}>
        <Animated.View style={moonStyle}>
          <GlowMoon />
        </Animated.View>
        <Animated.View style={[styles.celestialBodyOverlay, sunStyle]}>
          <GlowSun />
        </Animated.View>
      </View>
    </View>
  );
}

// Coin-style button that flips the scene between day and night.
function CelestialToggle({ isDay, onPress }: { isDay: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: isDay }}
      accessibilityLabel={isDay ? "Switch to night" : "Switch to day"}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [styles.celestialToggle, isDay && styles.celestialToggleDay, pressed && styles.celestialTogglePressed]}
    >
      {isDay ? <Sun size={15} color="#31543c" /> : <Moon size={15} color="#f2eaff" />}
    </Pressable>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setOnboardingTheme = useUIStore((s) => s.setOnboardingTheme);
  const palette = useGardenPalette();
  const playClick = useGardenClickSound();
  const playContinueClick = useGardenContinueSound();
  const fadeOutAmbience = useGardenAmbienceFadeOut();
  const enterDemo = useDemoModeStore((s) => s.enter);
  const isDay = palette.isDay;

  return (
    <View style={[styles.root, isDay && styles.rootDay, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
      <GardenBackdrop isDay={isDay} />
      <CelestialSky isDay={isDay} topOffset={insets.top} />
      <View pointerEvents="none" style={[styles.gardenShade, isDay && styles.gardenShadeDay]} />

      <View style={styles.topBar}>
        <Text style={[styles.brand, { color: palette.inkStrong }, isDay && styles.brandDay]}>
          TAMALIFE
        </Text>
        <View style={styles.topControls}>
          <AmbienceButton compact />
          <CelestialToggle isDay={isDay} onPress={() => { playClick(); setOnboardingTheme(isDay ? "night" : "day"); }} />
        </View>
      </View>

      {/* Purely decorative text — must not swallow touches meant for the
          celestial sky button underneath (it shares this screen region and
          sits at a lower zIndex, so without this the button is unreachable). */}
      <Animated.View entering={FadeInDown.duration(560)} style={styles.intro} pointerEvents="none">
        <View style={[styles.eyebrowPill, isDay && styles.eyebrowPillDay]}>
          <Text style={[styles.eyebrow, { color: palette.accent }]}>A COZY MONEY ADVENTURE</Text>
        </View>
        <Text style={[styles.title, { color: palette.inkStrong }, isDay && styles.titleDay]}>
          WELCOME TO{`\n`}TAMALIFE
        </Text>
        <Text style={[styles.description, { color: palette.body }, isDay && styles.descriptionDay]}>
          Grow better money habits with a tiny friend by your side.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(160).duration(600)} style={styles.hero}>
        <View style={styles.speech}>
          <Text style={styles.speechText}>HI! I'M PENNY.</Text>
          <Text style={styles.speechSubtext}>LET'S GROW SOMETHING GREAT!</Text>
          <View style={styles.speechTail} />
        </View>
        <PennyPiggy isDay={isDay} />
        <View style={[styles.nameRibbon, isDay && styles.nameRibbonDay]}>
          <Text style={[styles.nameText, isDay && styles.nameTextDay]}>PENNY · YOUR MONEY BUDDY</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(300).duration(500)} style={styles.bottom}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start growing"
          onPress={() => { playContinueClick(); fadeOutAmbience(); router.push("/(auth)/onboarding/value"); }}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <LinearGradient colors={["#FFDD73", "#F4B942"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaInner}>
            <Text style={styles.ctaText}>START GROWING</Text>
            <ChevronRight size={20} color="#5A3F12" strokeWidth={3} />
          </LinearGradient>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            playClick();
            fadeOutAmbience();
            router.push({ pathname: "/(auth)/sign-up", params: { mode: "signIn" } });
          }}
          style={styles.accountButton}
          hitSlop={8}
        >
          <Text style={[styles.accountText, isDay && styles.accountTextDay]}>I ALREADY HAVE AN ACCOUNT</Text>
        </Pressable>
        {demoModeAvailable && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              playClick();
              fadeOutAmbience();
              enterDemo();
              router.replace("/(tabs)/home");
            }}
            style={styles.accountButton}
            hitSlop={8}
          >
            <Text style={[styles.accountText, isDay && styles.accountTextDay]}>TRY DEMO DATA</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0e0d27", paddingHorizontal: 20, overflow: "hidden" },
  rootDay: { backgroundColor: "#d8edaa" },
  gardenBackground: { ...StyleSheet.absoluteFillObject, width: "110%", height: "110%", left: "-5%", top: "-5%" },
  gardenShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(12, 9, 34, 0.43)" },
  gardenShadeDay: { backgroundColor: "rgba(255, 247, 205, 0.09)" },
  atmosphere: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  lanternGlow: { position: "absolute", width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255, 200, 90, 0.22)", shadowColor: "#ffc85a", shadowOpacity: 0.8, shadowRadius: 18 },
  lanternOne: { left: "1.8%", bottom: "2.5%" },
  lanternTwo: { right: "1.8%", bottom: "8%" },
  welcomeFlame: { position: "absolute", width: 9, height: 14, borderRadius: 7, backgroundColor: "#fff3a0", borderWidth: 2, borderColor: "#ffad32", shadowColor: "#ffca4e", shadowOpacity: 1, shadowRadius: 8 },
  welcomeFlameOne: { left: "3.4%", bottom: "6%" },
  welcomeFlameTwo: { right: "3.3%", bottom: "11.5%" },
  windLeaf: { position: "absolute", color: "#a8d982", fontSize: 19, textShadowColor: "#10132d", textShadowRadius: 3, textShadowOffset: { width: 1, height: 2 } },
  windLeafOne: { top: "30%", left: "7%" },
  windLeafTwo: { bottom: "34%", right: "12%", color: "#d8a6cb" },
  firefly: { position: "absolute", width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff08b", shadowColor: "#ffe45d", shadowOpacity: 1, shadowRadius: 8 },
  fireflyOne: { top: "25%", right: "18%" },
  fireflyTwo: { top: "52%", left: "11%" },
  fireflyThree: { bottom: "26%", right: "25%" },
  sunbeam: { position: "absolute", top: -90, left: "34%", width: 115, height: "66%", backgroundColor: "#fff8be" },
  pollen: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff4a3", shadowColor: "#fffbd2", shadowOpacity: 0.8, shadowRadius: 5 },
  pollenOne: { top: "23%", left: "19%" },
  pollenTwo: { top: "45%", right: "17%" },
  pollenThree: { bottom: "24%", left: "27%" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 2 },
  topControls: { flexDirection: "row", alignItems: "center", gap: 7 },
  brand: { fontSize: 18, letterSpacing: 2.2, fontFamily: fonts.pixelBold, textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  brandDay: { textShadowColor: "rgba(255,255,255,0.8)", textShadowRadius: 5 },
  celestialSky: { position: "absolute", top: 0, left: 0, right: 0, height: 300, zIndex: 1 },
  celestialBody: { position: "absolute", right: -32 },
  celestialBodyOverlay: { position: "absolute", top: 0, left: 0 },
  celestialToggle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(42,27,75,0.94)", borderWidth: 2, borderColor: "#a99ae9" },
  celestialToggleDay: { backgroundColor: "rgba(255,248,209,0.94)", borderColor: "#568b61" },
  celestialTogglePressed: { transform: [{ translateY: 2 }] },
  intro: { alignItems: "center", marginTop: 18, zIndex: 2 },
  eyebrowPill: { backgroundColor: "rgba(139,124,255,0.28)", borderWidth: 1, borderColor: "rgba(184,174,255,0.5)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginBottom: spacing.md },
  eyebrowPillDay: { backgroundColor: "rgba(255, 247, 210, 0.9)", borderColor: "#578c61" },
  eyebrow: { fontFamily: fonts.pixel, fontSize: 10, letterSpacing: 1 },
  // Regular (not bold) pixel weight, with extra tracking — the bold cut closes
  // the "C" counter enough that it reads as an "O" at this size.
  title: { fontFamily: fonts.pixel, fontSize: 32, lineHeight: 36, letterSpacing: 2, textAlign: "center", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  titleDay: { textShadowColor: "rgba(255,255,255,0.8)", textShadowRadius: 5 },
  description: { fontFamily: fonts.pixel, fontSize: 13, lineHeight: 20, textAlign: "center", maxWidth: 300, marginTop: spacing.md },
  descriptionDay: { textShadowColor: "rgba(255,255,255,0.7)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  hero: { flex: 1, minHeight: 300, alignItems: "center", justifyContent: "center", zIndex: 2 },
  speech: { backgroundColor: "#fff7d8", borderWidth: 3, borderColor: "#332051", borderRadius: 10, paddingHorizontal: 15, paddingVertical: 8, zIndex: 3, marginBottom: -7, shadowColor: "#161027", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.6, shadowRadius: 0 },
  speechText: { color: "#332051", fontSize: 13, fontFamily: fonts.pixelBold, textAlign: "center", letterSpacing: 0.6 },
  speechSubtext: { color: "#8a5b65", fontSize: 9, fontFamily: fonts.pixel, textAlign: "center", marginTop: 2 },
  speechTail: { position: "absolute", width: 13, height: 13, backgroundColor: "#fff7d8", borderRightWidth: 3, borderBottomWidth: 3, borderColor: "#332051", bottom: -8, left: "46%", transform: [{ rotate: "45deg" }] },
  nameRibbon: { marginTop: -5, backgroundColor: "#30205a", borderWidth: 2, borderColor: "#b2a3eb", borderRadius: 7, paddingHorizontal: 12, paddingVertical: 6 },
  nameRibbonDay: { backgroundColor: "#fff1bb", borderColor: "#4f8358" },
  nameText: { color: "#fff2aa", fontFamily: fonts.pixel, fontSize: 10, letterSpacing: 0.6 },
  nameTextDay: { color: "#31543c" },
  bottom: { alignItems: "center", zIndex: 2 },
  cta: { width: "100%", maxWidth: 340, borderRadius: 18, borderWidth: 2, borderColor: "#B9852A", overflow: "hidden", shadowColor: "#F4B942", shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  ctaPressed: { transform: [{ scale: 0.98 }] },
  ctaInner: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ctaText: { fontFamily: fonts.pixelBold, fontSize: 16, color: "#5A3F12", letterSpacing: 1.5 },
  accountButton: { marginTop: 15, marginBottom: 2 },
  accountText: { color: "#fff3b3", fontFamily: fonts.pixel, fontSize: 10, letterSpacing: 0.5, textDecorationLine: "underline", textShadowColor: "#171027", textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 2 },
  accountTextDay: { color: "#224b36", textShadowColor: "#fff8d3", textShadowRadius: 3 },
});
