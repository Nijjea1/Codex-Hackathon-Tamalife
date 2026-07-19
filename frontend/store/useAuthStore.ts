import { create } from "zustand";

type OnboardingAnswers = {
  protections: string[];
  goal: string | null;
  expenseCount: string | null;
  reminderDays: string[];
};

type AuthState = {
  isOnboarded: boolean;
  selectedStarter: string | null;
  userName: string;
  answers: OnboardingAnswers;
  setStarter: (id: string) => void;
  setAnswer: <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => void;
  setUserName: (name: string) => void;
  completeOnboarding: () => void;
  resetLocalState: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  isOnboarded: false,
  selectedStarter: null,
  userName: "Alex",
  answers: { protections: [], goal: null, expenseCount: null, reminderDays: [] },
  setStarter: (id) => set({ selectedStarter: id }),
  setAnswer: (key, value) =>
    set((s) => ({ answers: { ...s.answers, [key]: value } })),
  setUserName: (name) => set({ userName: name }),
  completeOnboarding: () => set({ isOnboarded: true }),
  resetLocalState: () =>
    set({
      isOnboarded: false,
      selectedStarter: null,
      answers: { protections: [], goal: null, expenseCount: null, reminderDays: [] },
    }),
}));
