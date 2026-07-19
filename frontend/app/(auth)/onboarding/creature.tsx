import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, type } from "../../../constants/theme";
import { Creature } from "../../../components/creatures/Creature";
import { ProgressHeader } from "../../../components/onboarding/ProgressHeader";
import { Button } from "../../../components/ui/Button";
import { useAuthStore } from "../../../store/useAuthStore";
import { CreatureSpecies } from "../../../types/subscription";

const starters: {
  id: string;
  name: string;
  species: CreatureSpecies;
  personality: string;
  tags: string[];
}[] = [
  {
    id: "sprout",
    name: "Sprout",
    species: "sprout",
    personality: "Calm and patient. Represents growth and savings.",
    tags: ["Calm", "Growth", "Loyal"],
  },
  {
    id: "glint",
    name: "Glint",
    species: "gem",
    personality: "Curious and sharp-eyed. Represents awareness and discovery.",
    tags: ["Curious", "Sharp", "Bright"],
  },
  {
    id: "puff",
    name: "Puff",
    species: "cloud",
    personality: "Cheerful and squishy. Represents calm and simplicity.",
    tags: ["Cheerful", "Soft", "Easygoing"],
  },
];

export default function ChooseCreatureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setStarter = useAuthStore((s) => s.setStarter);
  const [index, setIndex] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const width = Dimensions.get("window").width;

  const active = starters[index];

  const choose = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStarter(active.id);
    setCelebrating(true);
    setTimeout(() => router.push("/(auth)/sign-up"), 1400);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={{ paddingHorizontal: spacing.md }}>
        <ProgressHeader step={5} total={5} />
        <Text style={[type.display, { marginTop: spacing.lg }]}>Choose your first guardian.</Text>
        <Text style={[type.body, { marginTop: spacing.sm }]}>
          Swipe to meet them. Tap to see them react.
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        style={{ flexGrow: 0, marginTop: spacing.lg }}
      >
        {starters.map((s) => (
          <View key={s.id} style={[styles.slide, { width }]}>
            <View style={styles.stage}>
              <Creature species={s.species} mood="happy" size="large" interactive />
            </View>
            <Text style={styles.name}>{s.name}</Text>
            <Text style={[type.body, { textAlign: "center", paddingHorizontal: spacing.xl }]}>
              {s.personality}
            </Text>
            <View style={styles.tags}>
              {s.tags.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {starters.map((s, i) => (
          <View key={s.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label={`Choose ${active.name}`} onPress={choose} />
      </View>

      {celebrating && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.celebration}>
          <Animated.View entering={ZoomIn.springify().damping(10)}>
            <Creature species={active.species} mood="happy" size="large" />
          </Animated.View>
          <Animated.Text entering={FadeIn.delay(300)} style={styles.celebrationText}>
            {active.name} joins your garden!
          </Animated.Text>
          <View style={styles.confettiRow}>
            {["#8B7CFF", "#55D6BE", "#F6C453", "#62D98B", "#B8AEFF"].map((c, i) => (
              <Animated.View
                key={i}
                entering={ZoomIn.delay(150 + i * 90).springify()}
                style={[styles.confetti, { backgroundColor: c }]}
              />
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  slide: { alignItems: "center" },
  stage: {
    width: 230,
    height: 230,
    borderRadius: 230,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: fonts.extraBold, fontSize: 26, color: colors.text, marginTop: spacing.md },
  tags: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm + 4 },
  tag: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  tagText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.primaryLight },
  dots: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: spacing.md,
  },
  dot: { width: 8, height: 8, borderRadius: 8, backgroundColor: colors.surfaceRaised },
  dotActive: { backgroundColor: colors.primary, width: 22 },
  footer: { marginTop: "auto", paddingHorizontal: spacing.md },
  celebration: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  celebrationText: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.text,
    marginTop: spacing.md,
  },
  confettiRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  confetti: { width: 10, height: 10, borderRadius: 3, transform: [{ rotate: "20deg" }] },
});
