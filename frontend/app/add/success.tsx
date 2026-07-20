import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { Creature } from "../../components/creatures/Creature";
import { Button } from "../../components/ui/Button";
import { GardenBackdrop } from "../../components/onboarding/GardenBackdrop";
import { useSubscriptionStore } from "../../store/useSubscriptionStore";
import { useUIStore } from "../../store/useUIStore";
import { Subscription } from "../../types/subscription";
import { useReceiptDraftStore } from "../../store/useReceiptDraftStore";
import { useDemoModeStore } from "../../store/useDemoModeStore";

const newSubscription: Subscription = {
  id: "streamflix-new",
  merchant: "StreamFlix",
  displayName: "Video Streaming",
  creatureName: "Nova",
  species: "gem",
  price: 19.99,
  previousPrice: 17.99,
  billingInterval: "monthly",
  nextActionDate: "2026-08-12",
  daysRemaining: 26,
  mood: "happy",
  healthScore: 90,
  category: "Entertainment",
  annualCost: 239.88,
  status: "active",
};

type Phase = "orb" | "egg" | "hatched";

// The hatch sequence: a glowing orb drops into an egg, the egg shakes,
// light bursts, and the new creature appears.
export default function SuccessScreen() {
  const router = useRouter();
  const p = useGardenPalette();
  const insets = useSafeAreaInsets();
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const addSubscription = useSubscriptionStore((s) => s.addSubscription);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const parsedSubscription = useReceiptDraftStore((s) => s.subscription);
  const demoMode = useDemoModeStore((s) => s.active);
  const activeSubscription = !demoMode && parsedSubscription ? parsedSubscription : newSubscription;
  const added = useRef(false);
  const [phase, setPhase] = useState<Phase>(reducedMotion ? "hatched" : "orb");

  const orbDrop = useSharedValue(-140);
  const shake = useSharedValue(0);
  const flash = useSharedValue(0);

  const commit = () => {
    if (demoMode && !added.current && !subscriptions.some((s) => s.id === activeSubscription.id)) {
      addSubscription(activeSubscription);
    }
    added.current = true;
  };

  useEffect(() => {
    if (reducedMotion) {
      commit();
      return;
    }
    orbDrop.value = withTiming(0, { duration: 700, easing: Easing.in(Easing.quad) });
    const t1 = setTimeout(() => setPhase("egg"), 800);
    const t2 = setTimeout(() => {
      shake.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 80 }),
          withTiming(5, { duration: 80 }),
          withTiming(0, { duration: 80 })
        ),
        3
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, 1000);
    const t3 = setTimeout(() => {
      flash.value = withSequence(
        withTiming(1, { duration: 180 }),
        withTiming(0, { duration: 500 })
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, 2000);
    const t4 = setTimeout(() => {
      setPhase("hatched");
      commit();
    }, 2300);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: orbDrop.value }],
  }));
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shake.value}deg` }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const skip = () => {
    commit();
    setPhase("hatched");
  };

  return (
    <View style={[styles.root, { backgroundColor: p.bgDeep, paddingBottom: insets.bottom + spacing.lg }]}>
      <GardenBackdrop />
      <View style={styles.stage}>
        {phase === "orb" && (
          <Animated.View style={[styles.orb, orbStyle]}>
            <View style={[styles.orbInner, { backgroundColor: p.goldLight, shadowColor: p.gold }]} />
          </Animated.View>
        )}
        {(phase === "orb" || phase === "egg") && (
          <Animated.View style={shakeStyle}>
            <Creature species="egg" mood="healthy" size="large" />
          </Animated.View>
        )}
        {phase === "hatched" && (
          <Animated.View entering={ZoomIn.springify().damping(9)}>
            <Creature species={activeSubscription.species} mood="happy" size="large" interactive />
          </Animated.View>
        )}
        <Animated.View pointerEvents="none" style={[styles.flash, flashStyle]} />
      </View>

      {phase === "hatched" ? (
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.bottom}>
          <Text style={[styles.title, { color: p.ink }]}>Meet {activeSubscription.creatureName}!</Text>
          <Text style={[styles.body, { color: p.body }]}>
            {activeSubscription.creatureName} is looking after your {activeSubscription.displayName}.
          </Text>
          <Button
            label={`Visit ${activeSubscription.creatureName}`}
            onPress={() => router.dismissTo(`/creature/${activeSubscription.id}`)}
            style={{ marginTop: spacing.lg, alignSelf: "stretch" }}
          />
          <Button
            label="Back to garden"
            variant="ghost"
            onPress={() => router.dismissTo("/(tabs)/garden")}
            style={{ marginTop: spacing.sm, alignSelf: "stretch" }}
          />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.delay(300)} style={styles.bottom}>
          <Text style={[styles.body, { color: p.body }]}>Something is hatching…</Text>
          <Pressable accessibilityRole="button" onPress={skip} style={styles.skip} hitSlop={10}>
            <Text style={[styles.skipText, { color: p.muted }]}>Skip</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.md, overflow: "hidden" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  orb: { position: "absolute", top: "22%", zIndex: 3 },
  orbInner: {
    width: 28,
    height: 28,
    borderRadius: 28,
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  flash: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#FFFFFF",
  },
  bottom: { paddingBottom: spacing.lg, alignItems: "center" },
  title: { fontFamily: fonts.pixelBold, fontSize: 28, letterSpacing: 0.5, textAlign: "center" },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, textAlign: "center", marginTop: spacing.sm, maxWidth: 320 },
  skip: { marginTop: spacing.md },
  skipText: { fontFamily: "monospace", fontWeight: "900", fontSize: 12 },
});
