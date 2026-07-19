import { create } from "zustand";

type DemoModeState = {
  active: boolean;
  enter: () => void;
  leave: () => void;
};

export const useDemoModeStore = create<DemoModeState>((set) => ({
  active: false,
  enter: () => set({ active: true }),
  leave: () => set({ active: false }),
}));

