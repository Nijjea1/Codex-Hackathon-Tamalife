import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, spacing } from "../../../constants/theme";
import { Creature } from "../../../components/creatures/Creature";
import { OnboardingShell } from "../../../components/onboarding/OnboardingShell";
import { OptionCard } from "../../../components/onboarding/OptionCard";
import { useAuthStore } from "../../../store/useAuthStore";
import { useUIStore } from "../../../store/useUIStore";

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
  const isDay = useUIStore((s) => s.onboardingTheme === "day");

  const toggle = (id: string) =>
    setAnswer(
      "reminderDays",
      reminderDays.includes(id) ? reminderDays.filter((d) => d !== id) : [...reminderDays, id]
    );

  // The furthest-out heads-up the user picked — chronologically that's the first
  // reminder Cloudy would actually send, so it's what the preview should show.
  const previewDays = reminderDays.length > 0 ? Math.max(...reminderDays.map(Number)) : 7;
  const previewDayLabel = `${previewDays} day${previewDays === 1 ? "" : "s"}`;

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

      <Text style={[styles.previewLabel, !isDay && styles.previewLabelNight]}>HOW A REMINDER LOOKS</Text>
      <View style={[styles.preview, !isDay && styles.previewNight]}>
        <View style={styles.previewCreature}>
          <Creature species="cloud" mood="concerned" size="small" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.previewTitle, !isDay && styles.previewTitleNight]}>Cloudy looks worried</Text>
          <Text style={[styles.previewBody, !isDay && styles.previewBodyNight]}>Your storage plan renews in {previewDayLabel}.</Text>
        </View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  previewLabel: { fontFamily: "monospace", fontWeight: "900", fontSize: 10, letterSpacing: 0.9, color: "#b06a43", marginTop: spacing.md, marginBottom: 4 },
  previewLabelNight: { color: "#ffd66e" },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    backgroundColor: "rgba(255,244,200,0.96)",
    borderWidth: 3,
    borderColor: "#4f7b55",
    borderRadius: 8,
    padding: spacing.sm + 4,
    shadowColor: "#587245",
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 0,
  },
  previewCreature: { transform: [{ scale: 0.7 }], width: 52, alignItems: "center" },
  previewNight: { backgroundColor: "rgba(50,38,83,0.96)", borderColor: "#9b8ad6", shadowColor: "#120d27" },
  previewTitle: { fontFamily: "monospace", fontWeight: "900", fontSize: 13, color: "#294d38" },
  previewTitleNight: { color: "#fff4d4" },
  previewBody: { fontFamily: fonts.regular, fontSize: 12, color: "#607056", marginTop: 1 },
  previewBodyNight: { color: "#c7bddf" },
});
