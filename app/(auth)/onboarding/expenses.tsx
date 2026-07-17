import { useRouter } from "expo-router";
import React from "react";
import { OnboardingShell } from "../../../components/onboarding/OnboardingShell";
import { OptionCard } from "../../../components/onboarding/OptionCard";
import { useAuthStore } from "../../../store/useAuthStore";

const options = [
  { id: "1-5", title: "1–5" },
  { id: "6-10", title: "6–10" },
  { id: "11-20", title: "11–20" },
  { id: "20+", title: "More than 20" },
  { id: "unknown", title: "I have no idea" },
];

export default function ExpensesScreen() {
  const router = useRouter();
  const expenseCount = useAuthStore((s) => s.answers.expenseCount);
  const setAnswer = useAuthStore((s) => s.setAnswer);

  return (
    <OnboardingShell
      step={3}
      total={5}
      question="How many recurring expenses do you have?"
      supporting="A rough guess is fine."
      canContinue={expenseCount !== null}
      onContinue={() => router.push("/(auth)/onboarding/reminders")}
      companionMessage={
        expenseCount === "unknown"
          ? "That's normal. We'll help you find them."
          : expenseCount
          ? "Noted! We'll make room in the garden."
          : undefined
      }
    >
      {options.map(({ id, title }) => (
        <OptionCard
          key={id}
          title={title}
          selected={expenseCount === id}
          onPress={() => setAnswer("expenseCount", id)}
        />
      ))}
    </OnboardingShell>
  );
}
