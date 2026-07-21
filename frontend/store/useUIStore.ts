import { create } from "zustand";

type ToastPayload = { message: string; tone: "success" | "info" | "warning" };
export type CurrencyCode = "USD" | "CAD" | "EUR" | "GBP";

type UIState = {
  reducedMotion: boolean;
  currency: CurrencyCode;
  onboardingTheme: "day" | "night";
  ambienceEnabled: boolean;
  onboardingStep: number;
  showCelebration: boolean;
  toast: ToastPayload | null;
  setReducedMotion: (value: boolean) => void;
  setCurrency: (currency: CurrencyCode) => void;
  setOnboardingTheme: (theme: "day" | "night") => void;
  setAmbienceEnabled: (enabled: boolean) => void;
  setOnboardingStep: (step: number) => void;
  setShowCelebration: (value: boolean) => void;
  showToast: (toast: ToastPayload) => void;
  hideToast: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  reducedMotion: false,
  currency: "USD",
  onboardingTheme: "day",
  ambienceEnabled: false,
  onboardingStep: 0,
  showCelebration: false,
  toast: null,
  setReducedMotion: (value) => set({ reducedMotion: value }),
  setCurrency: (currency) => set({ currency }),
  setOnboardingTheme: (onboardingTheme) => set({ onboardingTheme }),
  setAmbienceEnabled: (ambienceEnabled) => set({ ambienceEnabled }),
  setOnboardingStep: (step) => set({ onboardingStep: step }),
  setShowCelebration: (value) => set({ showCelebration: value }),
  showToast: (toast) => set({ toast }),
  hideToast: () => set({ toast: null }),
}));
