import { create } from "zustand";

type ToastPayload = { message: string; tone: "success" | "info" | "warning" };

type UIState = {
  reducedMotion: boolean;
  onboardingStep: number;
  showCelebration: boolean;
  toast: ToastPayload | null;
  setReducedMotion: (value: boolean) => void;
  setOnboardingStep: (step: number) => void;
  setShowCelebration: (value: boolean) => void;
  showToast: (toast: ToastPayload) => void;
  hideToast: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  reducedMotion: false,
  onboardingStep: 0,
  showCelebration: false,
  toast: null,
  setReducedMotion: (value) => set({ reducedMotion: value }),
  setOnboardingStep: (step) => set({ onboardingStep: step }),
  setShowCelebration: (value) => set({ showCelebration: value }),
  showToast: (toast) => set({ toast }),
  hideToast: () => set({ toast: null }),
}));
