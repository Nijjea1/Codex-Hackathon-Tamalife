import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { PixelifySans_500Medium, PixelifySans_700Bold } from "@expo-google-fonts/pixelify-sans";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { AccessibilityInfo, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../constants/theme";
import { ClerkSync } from "../components/ClerkSync";
import { GardenAmbienceProvider } from "../components/onboarding/GardenAmbience";
import { ToastHost } from "../components/ui/Toast";
import { useUIStore } from "../store/useUIStore";
import { useDemoModeStore } from "../store/useDemoModeStore";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const setReducedMotion = useUIStore((s) => s.setReducedMotion);
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    PixelifySans_500Medium,
    PixelifySans_700Bold,
  });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => setReducedMotion(!!enabled));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) =>
      setReducedMotion(!!enabled)
    );
    return () => sub.remove();
  }, [setReducedMotion]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthenticatedNavigation />
    </ClerkProvider>
  );
}

function AuthenticatedNavigation() {
  const { isLoaded, isSignedIn } = useAuth();
  const demoMode = useDemoModeStore((s) => s.active);

  if (!isLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <ClerkSync />
          <GardenAmbienceProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: "fade_from_bottom",
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Protected guard={!!isSignedIn || demoMode}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="add" options={{ presentation: "modal" }} />
                <Stack.Screen name="creature/[id]" />
                <Stack.Screen name="subscription/[id]" />
                <Stack.Screen name="edit/[id]" />
                <Stack.Screen name="notification-preferences" />
              </Stack.Protected>
            </Stack>
            <ToastHost />
          </GardenAmbienceProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
  );
}
