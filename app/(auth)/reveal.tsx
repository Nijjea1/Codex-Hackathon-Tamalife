import { useAuth } from "@clerk/expo";
import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, type } from "../../constants/theme";
import { Creature } from "../../components/creatures/Creature";
import { Button } from "../../components/ui/Button";
import { mockSubscriptions } from "../../data/mockSubscriptions";
import { useAuthStore } from "../../store/useAuthStore";
import { CreatureSpecies } from "../../types/subscription";

const starterSpecies: Record<string, CreatureSpecies> = {
  sprout: "sprout",
  glint: "gem",
  puff: "cloud",
};

// First garden reveal: the starter appears alone, then the demo creatures
// emerge one by one around it.
export default function RevealScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const selectedStarter = useAuthStore((s) => s.selectedStarter);
  const [phase, setPhase] = useState<"starter" | "garden">("starter");

  const species = starterSpecies[selectedStarter ?? "sprout"] ?? "sprout";

  useEffect(() => {
    const t = setTimeout(() => setPhase("garden"), 1600);
    return () => clearTimeout(t);
  }, []);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-up" />;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.stage}>
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <Creature species={species} mood="happy" size="large" />
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
        <Animated.View entering={FadeInDown.delay(1100).springify()} style={styles.bottom}>
          <Text style={[type.display, { textAlign: "center" }]}>Your garden is ready.</Text>
          <Text style={[type.body, { textAlign: "center", marginTop: spacing.sm }]}>
            We added a few examples so you can see how Tamalife works.
          </Text>
          <Button
            label="Meet my creatures"
            onPress={() => router.replace("/(tabs)/home")}
            style={{ marginTop: spacing.lg, alignSelf: "stretch" }}
          />
        </Animated.View>
      )}

      {phase === "starter" && (
        <Animated.View entering={FadeIn.delay(400)} style={styles.bottom}>
          <Text style={[type.body, { textAlign: "center" }]}>A seed of light lands nearby…</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  gardenRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  bottom: { paddingBottom: spacing.lg },
});
