import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing } from "../../../constants/theme";
import { Creature } from "../../../components/creatures/Creature";
import { OnboardingShell } from "../../../components/onboarding/OnboardingShell";
import { OptionCard } from "../../../components/onboarding/OptionCard";
import { useAuthStore } from "../../../store/useAuthStore";

const options = [
  { id: "14", title: "14 days before", description: "Plenty of time to decide" },
  { id: "7", title: "7 days before", description: "A comfortable heads-up" },
  { id: "3", title: "3 days before", description: "Just enough warning" },
  { id: "1", title: "1 day before", description: "Last call" },
];

export default function RemindersScreen() {
  const router = useRouter();
  const reminderDays = useAuthStore((s) => s.answers.reminderDays);
  const setAnswer = useAuthStore((s) => s.setAnswer);

  const toggle = (id: string) =>
    setAnswer(
      "reminderDays",
      reminderDays.includes(id) ? reminderDays.filter((d) => d !== id) : [...reminderDays, id]
    );

  return (
    <OnboardingShell
      step={4}
      total={5}
      question="When should your creatures warn you?"
      supporting="Pick as many as you like. No real notifications in this prototype."
      canContinue={reminderDays.length > 0}
      onContinue={() => router.push("/(auth)/onboarding/creature")}
      companionMessage={reminderDays.length > 0 ? "I'll make sure you hear about it." : undefined}
    >
      {options.map(({ id, title, description }) => (
        <OptionCard
          key={id}
          title={title}
          description={description}
          selected={reminderDays.includes(id)}
          onPress={() => toggle(id)}
        />
      ))}

      <View style={styles.preview}>
        <View style={styles.previewCreature}>
          <Creature species="cloud" mood="concerned" size="small" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.previewTitle}>Cloudy looks worried</Text>
          <Text style={styles.previewBody}>Your storage plan renews in 7 days.</Text>
        </View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginTop: spacing.sm,
  },
  previewCreature: { transform: [{ scale: 0.7 }], width: 52, alignItems: "center" },
  previewTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  previewBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
});
