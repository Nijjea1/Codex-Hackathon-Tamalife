import { useRouter } from "expo-router";
import { CalendarCheck, PiggyBank, Scissors, Search } from "lucide-react-native";
import React from "react";
import { colors } from "../../../constants/theme";
import { OnboardingShell } from "../../../components/onboarding/OnboardingShell";
import { OptionCard } from "../../../components/onboarding/OptionCard";
import { useAuthStore } from "../../../store/useAuthStore";

const options = [
  { id: "save", title: "Save more each month", description: "Your creature holds onto a shiny coin", icon: PiggyBank },
  { id: "dates", title: "Stay ahead of due dates", description: "Your creature keeps a tiny calendar", icon: CalendarCheck },
  { id: "cancel", title: "Cancel things I don't use", description: "Your creature cuts the rope", icon: Scissors },
  { id: "understand", title: "Understand where my money goes", description: "Your creature inspects the charts", icon: Search },
];

export default function GoalsScreen() {
  const router = useRouter();
  const goal = useAuthStore((s) => s.answers.goal);
  const setAnswer = useAuthStore((s) => s.setAnswer);

  const messages: Record<string, string> = {
    save: "Ooh, a coin! I'll guard it with my life.",
    dates: "I never miss a date. Tiny calendar acquired.",
    cancel: "Snip snip. Let's cut some ropes.",
    understand: "Charts! I love a good chart.",
  };

  return (
    <OnboardingShell
      step={2}
      total={5}
      question="What would feel like a win?"
      supporting="Pick the one that matters most right now."
      canContinue={goal !== null}
      onContinue={() => router.push("/(auth)/onboarding/expenses")}
      companionMessage={goal ? messages[goal] : undefined}
    >
      {options.map(({ id, title, description, icon: Icon }) => (
        <OptionCard
          key={id}
          title={title}
          description={description}
          icon={<Icon size={20} color={colors.secondary} />}
          selected={goal === id}
          onPress={() => setAnswer("goal", id)}
        />
      ))}
    </OnboardingShell>
  );
}
