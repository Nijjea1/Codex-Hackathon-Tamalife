import { create } from "zustand";

type ToastPayload = { message: string; tone: "success" | "info" | "warning" };

type UIState = {
  reducedMotion: boolean;
  onboardingTheme: "day" | "night";
  ambienceEnabled: boolean;
  onboardingStep: number;
  showCelebration: boolean;
  toast: ToastPayload | null;
  setReducedMotion: (value: boolean) => void;
  setOnboardingTheme: (theme: "day" | "night") => void;
  setAmbienceEnabled: (enabled: boolean) => void;
  setOnboardingStep: (step: number) => void;
  setShowCelebration: (value: boolean) => void;
  showToast: (toast: ToastPayload) => void;
  hideToast: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  reducedMotion: false,
  onboardingTheme: "day",
  ambienceEnabled: false,
  onboardingStep: 0,
  showCelebration: false,
  toast: null,
  setReducedMotion: (value) => set({ reducedMotion: value }),
  setOnboardingTheme: (onboardingTheme) => set({ onboardingTheme }),
  setAmbienceEnabled: (ambienceEnabled) => set({ ambienceEnabled }),
  setOnboardingStep: (step) => set({ onboardingStep: step }),
  setShowCelebration: (value) => set({ showCelebration: value }),
  showToast: (toast) => set({ toast }),
  hideToast: () => set({ toast: null }),
}));
