import { useRouter } from "expo-router";
import { AlertCircle, Clock, ShieldCheck, Sparkles, TrendingUp } from "lucide-react-native";
import React from "react";
import { OnboardingShell } from "../../../components/onboarding/OnboardingShell";
import { OptionCard } from "../../../components/onboarding/OptionCard";
import { useAuthStore } from "../../../store/useAuthStore";

const options = [
  { id: "renewals", title: "Surprise renewals", description: "Charges you forgot were coming", icon: AlertCircle },
  { id: "trials", title: "Forgotten free trials", description: "Trials that quietly become paid plans", icon: Clock },
  { id: "prices", title: "Price increases", description: "Plans that get more expensive over time", icon: TrendingUp },
  { id: "warranties", title: "Expired warranties", description: "Coverage that lapses without warning", icon: ShieldCheck },
  { id: "all", title: "All of the above", description: "Protect me from everything", icon: Sparkles },
];

export default function ValueScreen() {
  const router = useRouter();
  const protections = useAuthStore((s) => s.answers.protections);
  const setAnswer = useAuthStore((s) => s.setAnswer);

  const toggle = (id: string) => {
    if (id === "all") {
      setAnswer("protections", protections.includes("all") ? [] : ["all"]);
      return;
    }
    const withoutAll = protections.filter((p) => p !== "all");
    setAnswer(
      "protections",
      withoutAll.includes(id) ? withoutAll.filter((p) => p !== id) : [...withoutAll, id]
    );
  };

  return (
    <OnboardingShell
      step={1}
      total={5}
      question="What should Tamalife protect you from?"
      supporting="Pick everything that has burned you before."
      canContinue={protections.length > 0}
      onContinue={() => router.push("/(auth)/onboarding/goals")}
      companionMessage={protections.length > 0 ? "Good choice. I've got you covered." : undefined}
    >
      {options.map(({ id, title, description, icon: Icon }) => (
        <OptionCard
          key={id}
          title={title}
          description={description}
          icon={<Icon size={20} color="#3b7d58" />}
          selected={protections.includes(id)}
          onPress={() => toggle(id)}
        />
      ))}
    </OnboardingShell>
  );
}
