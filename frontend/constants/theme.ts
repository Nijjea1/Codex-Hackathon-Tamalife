export const colors = {
  background: "#0B0D17",
  backgroundRaised: "#111525",
  surface: "#171B2E",
  surfaceRaised: "#202640",
  primary: "#8B7CFF",
  primaryLight: "#B8AEFF",
  primaryDark: "#5F4FD8",
  secondary: "#55D6BE",
  success: "#62D98B",
  warning: "#F6C453",
  danger: "#F06A78",
  critical: "#D94E67",
  text: "#F7F8FC",
  textSecondary: "#A9AEC4",
  textMuted: "#70778F",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  overlay: "rgba(6,8,16,0.72)",
  successSoft: "rgba(98,217,139,0.14)",
  warningSoft: "rgba(246,196,83,0.14)",
  dangerSoft: "rgba(240,106,120,0.14)",
  primarySoft: "rgba(139,124,255,0.16)",
  secondarySoft: "rgba(85,214,190,0.14)",
} as const;

export const fonts = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semiBold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extraBold: "PlusJakartaSans_800ExtraBold",
  // Pixel display family for the cozy game-style onboarding.
  pixel: "PixelifySans_500Medium",
  pixelBold: "PixelifySans_700Bold",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 28,
  pill: 999,
} as const;

import type { TextStyle } from "react-native";

export const type = {
  display: { fontFamily: fonts.extraBold, fontSize: 32, lineHeight: 38, color: colors.text },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, color: colors.text },
  heading: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, color: colors.text },
  subheading: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 22, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  bodySmall: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  money: { fontFamily: fonts.extraBold, fontSize: 34, lineHeight: 40, color: colors.text, fontVariant: ["tabular-nums"] },
} satisfies Record<string, TextStyle>;
