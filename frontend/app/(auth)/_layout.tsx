import { useAuth } from "@clerk/expo";
import { Redirect, Stack, usePathname } from "expo-router";
import React from "react";
import { colors } from "../../constants/theme";
import { GardenAmbienceProvider } from "../../components/onboarding/GardenAmbience";
import { useDemoModeStore } from "../../store/useDemoModeStore";

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const demoMode = useDemoModeStore((s) => s.active);

  if (!isLoaded) return null;
  if ((isSignedIn || demoMode) && !pathname.endsWith("/reveal")) {
    return <Redirect href="/(tabs)/home" />;
  }

  return (
    <GardenAmbienceProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      />
    </GardenAmbienceProvider>
  );
}
