import { useAuth } from "@clerk/expo";
import { Redirect, Stack, usePathname } from "expo-router";
import React from "react";
import { colors } from "../../constants/theme";

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();

  if (!isLoaded) return null;
  if (isSignedIn && !pathname.endsWith("/reveal")) {
    return <Redirect href="/(tabs)/home" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    />
  );
}
