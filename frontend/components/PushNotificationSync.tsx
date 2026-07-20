import { useAuth } from "@clerk/expo";
import { useEffect } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { useApiClient } from "../lib/api";
import { useDemoModeStore } from "../store/useDemoModeStore";
import { DevicePlatformDto } from "../types/api";

/**
 * Registers this device's FCM token with the backend once the user is signed
 * in, and keeps it current when Firebase rotates the token.
 *
 * Push requires native Firebase code, so this is inert on web and in Expo Go —
 * it needs a development build to do anything.
 */
export function PushNotificationSync() {
  const { isSignedIn } = useAuth();
  const demoMode = useDemoModeStore((s) => s.active);
  const api = useApiClient();

  useEffect(() => {
    if (!isSignedIn || demoMode || Platform.OS === "web") return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const register = async (token: string) => {
      if (cancelled || !token) return;
      try {
        await api.registerPushToken({
          token,
          platform: Platform.OS as DevicePlatformDto,
        });
      } catch {
        // A failed registration just means no push until the next launch;
        // never surface it as a user-facing error.
      }
    };

    const setup = async () => {
      let messaging;
      try {
        messaging = (await import("@react-native-firebase/messaging")).default;
      } catch {
        // Native module unavailable (Expo Go / web) — nothing to register.
        return;
      }

      try {
        if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
        } else {
          const status = await messaging().requestPermission();
          const enabled =
            status === messaging.AuthorizationStatus.AUTHORIZED ||
            status === messaging.AuthorizationStatus.PROVISIONAL;
          if (!enabled) return;
        }

        if (cancelled) return;
        await register(await messaging().getToken());
        unsubscribe = messaging().onTokenRefresh(register);
      } catch {
        // Permission denied or Firebase unavailable — stay silent.
      }
    };

    void setup();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isSignedIn, demoMode, api]);

  return null;
}
