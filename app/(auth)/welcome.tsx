import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { Creature } from "../../components/creatures/Creature";
import { CreatureParticles } from "../../components/creatures/CreatureParticles";
import { Button } from "../../components/ui/Button";

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowBubble(true), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={[styles.ambient, { top: "5%", right: -80, backgroundColor: colors.primary }]} />
      <View style={[styles.ambient, { top: "30%", left: -90, backgroundColor: colors.secondary }]} />

      <View style={styles.heroArea}>
        {showBubble && (
          <Animated.View entering={FadeInDown.springify().damping(14)} style={styles.bubble}>
            <Text style={styles.bubbleText}>Ready to meet your expenses?</Text>
          </Animated.View>
        )}
        <Creature species="sprout" mood="happy" size="large" interactive />
        <CreatureParticles mood="happy" size={220} />
      </View>

      <Animated.View entering={FadeIn.delay(300).duration(600)} style={styles.bottom}>
        <Text style={[type.display, { textAlign: "center" }]}>Your money has a life.</Text>
        <Text style={[type.body, { textAlign: "center", marginTop: spacing.sm }]}>
          Turn subscriptions, bills and free trials into companions you'll never forget.
        </Text>
        <Button
          label="Start my garden"
          onPress={() => router.push("/(auth)/onboarding/value")}
          style={{ marginTop: spacing.lg, alignSelf: "stretch" }}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: "/(auth)/sign-up", params: { mode: "signIn" } })
          }
          style={{ marginTop: spacing.md }}
          hitSlop={8}
        >
          <Text style={styles.secondaryLink}>I already have an account</Text>
        </Pressable>
        <View style={styles.footerLinks}>
          <Text style={styles.footerLink}>Privacy</Text>
          <Text style={styles.footerDot}>·</Text>
          <Text style={styles.footerLink}>Terms</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  ambient: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 260,
    opacity: 0.07,
  },
  heroArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  bubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderBottomLeftRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  bubbleText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  bottom: { alignItems: "center", paddingBottom: spacing.sm },
  secondaryLink: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.primaryLight },
  footerLinks: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.md,
    alignItems: "center",
  },
  footerLink: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  footerDot: { color: colors.textMuted, fontSize: 11 },
});
