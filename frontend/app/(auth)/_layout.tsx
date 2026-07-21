import { useAuth } from "@clerk/expo";
import { Redirect, Stack, usePathname } from "expo-router";
import React from "react";
import { useGardenPalette } from "../../constants/garden";
import { useDemoModeStore } from "../../store/useDemoModeStore";

export default function AuthLayout() {
  const palette = useGardenPalette();
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const demoMode = useDemoModeStore((s) => s.active);

  if (!isLoaded) return null;
  if ((isSignedIn || demoMode) && !pathname.endsWith("/reveal")) {
    return <Redirect href="/(tabs)/home" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.bgDeep },
        animation: "slide_from_right",
      }}
    />
  );
}
