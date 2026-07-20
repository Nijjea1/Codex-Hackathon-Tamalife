import { useAuth } from "@clerk/expo";
import { useEffect } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { useApiClient } from "../lib/api";
import { useDemoModeStore } from "../store/useDemoModeStore";
import { DevicePlatformDto } from "../types/api";

const ANDROID_PERMISSION_API_LEVEL = 33;

/**
 * Registers this device's FCM token with the backend once the user is signed
 * in, and keeps it current when Firebase rotates the token.
 *
 * Push needs native Firebase code, so this is inert on web and in Expo Go; it
 * only does anything in a development or production build.
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
        await api.registerPushToken({ token, platform: Platform.OS as DevicePlatformDto });
      } catch {
        // Losing a registration only costs push until the next launch, so it
        // stays silent rather than interrupting the user.
      }
    };

    const granted = async (messaging: any): Promise<boolean> => {
      if (Platform.OS === "android" && Number(Platform.Version) >= ANDROID_PERMISSION_API_LEVEL) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }
      const status = await messaging().requestPermission();
      return (
        status === messaging.AuthorizationStatus.AUTHORIZED ||
        status === messaging.AuthorizationStatus.PROVISIONAL
      );
    };

    void (async () => {
      let messaging;
      try {
        messaging = (await import("@react-native-firebase/messaging")).default;
      } catch {
        return; // Native module absent: Expo Go, or a web bundle.
      }

      try {
        if (!(await granted(messaging))) return;
        await register(await messaging().getToken());

        // Cleanup may have run while awaiting, in which case the listener
        // would never be torn down.
        const off = messaging().onTokenRefresh(register);
        if (cancelled) off();
        else unsubscribe = off;
      } catch {
        // Permission refused, or Firebase is unreachable on this device.
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isSignedIn, demoMode, api]);

  return null;
}
