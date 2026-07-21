import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useApiClient } from "../lib/api";
import {
  configureForegroundNotificationHandler,
  loadFirebaseMessaging,
  presentForegroundPush,
  pushNotificationRoute,
  requestPushPermission,
  subscribeToLocalNotificationOpens,
} from "../lib/pushNotifications";
import { useDemoModeStore } from "../store/useDemoModeStore";
import { DevicePlatformDto } from "../types/api";

const REGISTRATION_RETRY_DELAYS_MS = [0, 500, 1_500];

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
  const router = useRouter();

  useEffect(() => {
    if (!isSignedIn || demoMode || Platform.OS === "web") return;

    let cancelled = false;
    let unsubscribeRefresh: (() => void) | undefined;
    let unsubscribeOpened: (() => void) | undefined;
    let unsubscribeForeground: (() => void) | undefined;
    let unsubscribeLocalOpened: (() => void) | undefined;
    let syncInFlight: Promise<void> | undefined;
    let initialNotificationChecked = false;
    let lastOpenedKey = "";
    let lastOpenedAt = 0;

    const openNotification = (data: Record<string, unknown> | undefined) => {
      if (cancelled) return;
      const key = typeof data?.delivery_id === "string" ? data.delivery_id : "";
      const now = Date.now();
      if (key && key === lastOpenedKey && now - lastOpenedAt < 1_000) return;
      lastOpenedKey = key;
      lastOpenedAt = now;
      router.push(pushNotificationRoute(data));
    };

    const register = async (token: string) => {
      if (cancelled || !token) return;
      for (const delay of REGISTRATION_RETRY_DELAYS_MS) {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        if (cancelled) return;
        try {
          await api.registerPushToken({ token, platform: Platform.OS as DevicePlatformDto });
          return;
        } catch {
          // Retry brief startup/network races. A later foreground transition
          // also retries without interrupting the user.
        }
      }
    };

    const sync = async () => {
      try {
        const firebase = await loadFirebaseMessaging();
        const messaging = firebase.getMessaging();
        await configureForegroundNotificationHandler();

        if (!unsubscribeOpened) {
          const off = firebase.onNotificationOpenedApp(messaging, (message) => {
            openNotification(message.data);
          });
          if (cancelled) off();
          else unsubscribeOpened = off;
        }
        if (!unsubscribeForeground) {
          const off = firebase.onMessage(messaging, (message) => {
            void presentForegroundPush(message);
          });
          if (cancelled) off();
          else unsubscribeForeground = off;
        }
        if (!unsubscribeLocalOpened) {
          const off = await subscribeToLocalNotificationOpens(openNotification);
          if (cancelled) off();
          else unsubscribeLocalOpened = off;
        }
        if (!initialNotificationChecked) {
          initialNotificationChecked = true;
          const initial = await firebase.getInitialNotification(messaging);
          if (initial) openNotification(initial.data);
        }

        if (!(await requestPushPermission(firebase))) return;

        if (!unsubscribeRefresh) {
          const off = firebase.onTokenRefresh(messaging, (token) => void register(token));
          if (cancelled) off();
          else unsubscribeRefresh = off;
        }
        await register(await firebase.getToken(messaging));
      } catch {
        // Native module absent (Expo Go), permission refused, or Firebase is
        // temporarily unavailable. Foregrounding the app retries the sync.
      }
    };

    const scheduleSync = () => {
      if (syncInFlight) return;
      syncInFlight = sync().finally(() => {
        syncInFlight = undefined;
      });
    };

    scheduleSync();
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") scheduleSync();
    });

    return () => {
      cancelled = true;
      unsubscribeRefresh?.();
      unsubscribeOpened?.();
      unsubscribeForeground?.();
      unsubscribeLocalOpened?.();
      appStateSubscription.remove();
    };
  }, [isSignedIn, demoMode, api, router]);

  return null;
}
