import { useAuth } from "@clerk/expo";
import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../../constants/theme";
import { Creature } from "../../components/creatures/Creature";
import { GardenBackdrop } from "../../components/onboarding/GardenBackdrop";
import { GardenButton } from "../../components/onboarding/GardenButton";
import { MascotPortrait } from "../../components/onboarding/MascotPortrait";
import { mockSubscriptions } from "../../data/mockSubscriptions";
import { useAuthStore } from "../../store/useAuthStore";
import { useUIStore } from "../../store/useUIStore";

// First garden reveal: the starter appears alone, then the demo creatures
// emerge one by one around it.
export default function RevealScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const selectedStarter = useAuthStore((s) => s.selectedStarter);
  const isDay = useUIStore((s) => s.onboardingTheme === "day");
  const [phase, setPhase] = useState<"starter" | "garden">("starter");

  const mascotId = selectedStarter ?? "penny";

  useEffect(() => {
    const t = setTimeout(() => setPhase("garden"), 1600);
    return () => clearTimeout(t);
  }, []);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-up" />;

  return (
    <View style={[styles.root, !isDay && styles.rootNight, { paddingBottom: insets.bottom + spacing.lg }]}>
      <GardenBackdrop hideSky />
      <View style={styles.stage}>
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <View style={styles.starterFrame}>
            <MascotPortrait id={mascotId} size={210} />
          </View>
        </Animated.View>

        {phase === "garden" && (
          <View style={styles.gardenRow}>
            {mockSubscriptions.slice(0, 4).map((s, i) => (
              <Animated.View
                key={s.id}
                entering={ZoomIn.delay(200 + i * 220).springify().damping(10)}
              >
                <Creature species={s.species} mood={s.mood} size="small" />
              </Animated.View>
            ))}
          </View>
        )}
      </View>

      {phase === "garden" && (
        <Animated.View entering={FadeInDown.delay(1100).springify()} style={[styles.bottom, !isDay && styles.bottomNight]}>
          <Text style={[styles.kicker, !isDay && styles.kickerNight]}>QUEST COMPLETE!</Text>
          <Text style={[styles.heading, !isDay && styles.headingNight]}>Your garden is ready.</Text>
          <Text style={[styles.supporting, !isDay && styles.supportingNight]}>
            We added a few examples so you can see how Tamalife works.
          </Text>
          <GardenButton
            label="MEET MY CREATURES"
            onPress={() => router.replace("/(tabs)/home")}
            style={{ marginTop: spacing.lg, alignSelf: "stretch" }}
          />
        </Animated.View>
      )}

      {phase === "starter" && (
        <Animated.View entering={FadeIn.delay(400)} style={[styles.bottom, !isDay && styles.bottomNight]}>
          <Text style={[styles.seedText, !isDay && styles.seedTextNight]}>A seed of light lands nearby…</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#e4efb7", paddingHorizontal: spacing.md },
  rootNight: { backgroundColor: "#151132" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  starterFrame: { borderRadius: 14, overflow: "hidden", borderWidth: 5, borderColor: "#fff0a6", shadowColor: "#405f3b", shadowOffset: { width: 5, height: 6 }, shadowOpacity: 0.6, shadowRadius: 0 },
  gardenRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  bottom: { padding: spacing.md, paddingBottom: spacing.lg, backgroundColor: "rgba(255,247,210,0.95)", borderWidth: 3, borderColor: "#4f7b55", shadowColor: "#587245", shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.55, shadowRadius: 0 },
  bottomNight: { backgroundColor: "rgba(43,31,76,0.96)", borderColor: "#9b8ad6", shadowColor: "#120d27" },
  kicker: { color: "#b06a43", fontFamily: "monospace", fontWeight: "900", fontSize: 10, letterSpacing: 1, textAlign: "center" },
  kickerNight: { color: "#ffd66e" },
  heading: { color: "#234f3a", fontFamily: "monospace", fontWeight: "900", fontSize: 25, textAlign: "center", marginTop: 6 },
  headingNight: { color: "#fff5d6" },
  supporting: { color: "#526348", fontFamily: "monospace", fontWeight: "700", fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: spacing.sm },
  supportingNight: { color: "#d6cdea" },
  seedText: { color: "#31543c", fontFamily: "monospace", fontWeight: "900", fontSize: 12, textAlign: "center" },
  seedTextNight: { color: "#eee8ff" },
});
