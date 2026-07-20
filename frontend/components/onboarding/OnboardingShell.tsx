import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../../constants/theme";
import { useUIStore } from "../../store/useUIStore";
import { CompanionReaction } from "./CompanionReaction";
import { GardenBackdrop } from "./GardenBackdrop";
import { GardenButton } from "./GardenButton";
import { ProgressHeader } from "./ProgressHeader";

type Props = {
  step: number;
  total: number;
  question: string;
  supporting: string;
  children: React.ReactNode;
  canContinue: boolean;
  onContinue: () => void;
  companionMessage?: string;
  continueLabel?: string;
};

export function OnboardingShell({
  step,
  total,
  question,
  supporting,
  children,
  canContinue,
  onContinue,
  companionMessage,
  continueLabel = "Continue",
}: Props) {
  const insets = useSafeAreaInsets();
  const isDay = useUIStore((s) => s.onboardingTheme === "day");
  return (
    <View style={[styles.root, !isDay && styles.rootNight]}>
      <GardenBackdrop strongerShade hideSky />
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md }}>
        <ProgressHeader step={step} total={total} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400).springify()} style={[styles.questionCard, !isDay && styles.questionCardNight]}>
          <Text style={[styles.stepLabel, !isDay && styles.stepLabelNight]}>GARDEN QUEST · STEP {step}</Text>
          <Text style={[styles.question, !isDay && styles.questionNight]}>{question}</Text>
          <Text style={[styles.supporting, !isDay && styles.supportingNight]}>
            {supporting}
          </Text>
        </Animated.View>
        <View style={styles.options}>{children}</View>
      </ScrollView>
      <View
        style={[
          styles.footer,
          !isDay && styles.footerNight,
          { paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <CompanionReaction hasSelection={canContinue} message={companionMessage} />
        <GardenButton
          label={continueLabel}
          onPress={onContinue}
          disabled={!canContinue}
          style={{ marginTop: spacing.sm + 4 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#e4efb7" },
  rootNight: { backgroundColor: "#151132" },
  questionCard: { marginTop: spacing.md, marginBottom: spacing.md, backgroundColor: "rgba(255, 247, 210, 0.94)", borderWidth: 3, borderColor: "#4f7b55", padding: spacing.md, shadowColor: "#587245", shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.6, shadowRadius: 0 },
  questionCardNight: { backgroundColor: "rgba(43,31,76,0.95)", borderColor: "#9b8ad6", shadowColor: "#120d27" },
  stepLabel: { color: "#b06a43", fontFamily: "monospace", fontWeight: "900", fontSize: 10, letterSpacing: 0.9 },
  stepLabelNight: { color: "#ffd66e" },
  question: { color: "#234f3a", fontFamily: "monospace", fontWeight: "900", fontSize: 25, lineHeight: 30, marginTop: 8 },
  questionNight: { color: "#fff5d6" },
  supporting: { color: "#526348", fontFamily: "monospace", fontWeight: "700", fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
  supportingNight: { color: "#d6cdea" },
  options: { paddingTop: 2 },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#6e8e5b",
    backgroundColor: "rgba(255, 248, 215, 0.95)",
  },
  footerNight: { borderTopColor: "#7566a5", backgroundColor: "rgba(30,22,57,0.96)" },
});
