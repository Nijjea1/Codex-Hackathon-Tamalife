import { useUIStore } from "../store/useUIStore";
import { GardenMode, resolveGardenMode } from "./gardenMode";

export { GardenMode, resolveGardenMode } from "./gardenMode";

// Cozy day/night garden palette shared across the whole app so every screen
// matches the onboarding experience. Colors are pulled from the onboarding
// welcome/sign-up screens so the look stays consistent.

export const gardenDay = {
  isDay: true as boolean,
  bg: "#d8edaa",
  bgDeep: "#c9e39a",
  // Cream "sticker" card surfaces.
  cardBg: "rgba(255,247,210,0.96)",
  cardBgSolid: "#fff7d2",
  cardBorder: "#4f7b55",
  cardShadow: "#587245",
  // Text.
  ink: "#234f3a",
  inkStrong: "#122a1a",
  body: "#4c5f42",
  muted: "#6c7a5c",
  onGold: "#5A3F12",
  // Accents.
  accent: "#b06a43",
  gold: "#F4B942",
  goldLight: "#FFDD73",
  goldBorder: "#B9852A",
  leaf: "#5b8c4e",
  // Pills / chips.
  pill: "rgba(255,247,210,0.9)",
  pillBorder: "#578c61",
  pillInk: "#31543c",
  // Status.
  success: "#3f7d4e",
  successBg: "rgba(120,178,110,0.28)",
  warning: "#c8892f",
  warningBg: "rgba(240,196,120,0.32)",
  danger: "#c2452f",
  dangerBg: "rgba(220,120,96,0.24)",
  // Input.
  inputBg: "#fffbed",
  inputBorder: "#789263",
  inputInk: "#294d38",
  // Overlay for modals / bottom sheets.
  overlay: "rgba(24, 40, 20, 0.42)",
} as const;

export const gardenNight = {
  isDay: false as boolean,
  bg: "#0e0d27",
  bgDeep: "#151132",
  cardBg: "rgba(43,31,76,0.96)",
  cardBgSolid: "#2b1f4c",
  cardBorder: "#9b8ad6",
  cardShadow: "#120d27",
  ink: "#fff5d6",
  inkStrong: "#fff7d8",
  body: "#d6cdea",
  muted: "#a99ec6",
  onGold: "#5A3F12",
  accent: "#ffd66e",
  gold: "#F4B942",
  goldLight: "#FFDD73",
  goldBorder: "#B9852A",
  leaf: "#9fd08a",
  pill: "rgba(50,38,83,0.9)",
  pillBorder: "#a99ae9",
  pillInk: "#eee8ff",
  success: "#8fd6a0",
  successBg: "rgba(80,140,95,0.32)",
  warning: "#ffd66e",
  warningBg: "rgba(120,95,40,0.35)",
  danger: "#ff8a7a",
  dangerBg: "rgba(120,50,55,0.4)",
  inputBg: "#241b43",
  inputBorder: "#806fb2",
  inputInk: "#fff5e6",
  overlay: "rgba(8, 6, 24, 0.62)",
} as const;

// Widen the literal `as const` values so day and night share one type.
type Widen<T> = { [K in keyof T]: T[K] extends boolean ? boolean : string };
export type GardenPalette = Widen<typeof gardenDay>;

export function useGardenMode(): GardenMode {
  return useUIStore((state) => resolveGardenMode(state.onboardingTheme));
}

/**
 * Day/night garden palette driven by the global onboarding theme toggle, so
 * flipping day/night anywhere re-themes every screen that uses it.
 */
export function useGardenPalette(): GardenPalette {
  const mode = useGardenMode();
  return mode === "night" ? gardenNight : gardenDay;
}
