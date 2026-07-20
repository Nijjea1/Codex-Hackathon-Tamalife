import { Stack } from "expo-router";
import React from "react";
import { colors } from "../../constants/theme";
import { GardenAmbienceProvider } from "../../components/onboarding/GardenAmbience";

export default function AuthLayout() {
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
