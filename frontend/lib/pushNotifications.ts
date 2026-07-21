import type { Href } from "expo-router";
import { PermissionsAndroid, Platform } from "react-native";

type UnregisterPushToken = (token: string) => Promise<void>;
type NotificationData = Record<string, unknown> | undefined;
type ForegroundMessage = {
  data?: Record<string, string | object>;
  messageId?: string;
  notification?: { body?: string; title?: string };
};

let foregroundHandlerConfigured = false;

export async function loadFirebaseMessaging() {
  return import("@react-native-firebase/messaging");
}

export function pushNotificationRoute(data: NotificationData): Href {
  const subscriptionId =
    typeof data?.subscription_id === "string" ? data.subscription_id.trim() : "";
  if (subscriptionId) {
    return {
      pathname: "/creature/[id]",
      params: { id: subscriptionId },
    };
  }

  if (data?.category === "weekly_digest") return "/(tabs)/insights";
  if (data?.category === "re_engagement") return "/(tabs)/garden";
  return "/(tabs)/home";
}

export async function configureForegroundNotificationHandler(): Promise<void> {
  if (foregroundHandlerConfigured) return;
  const notifications = await import("expo-notifications");
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  foregroundHandlerConfigured = true;
}

export async function presentForegroundPush(message: ForegroundMessage): Promise<void> {
  const title = message.notification?.title;
  const body = message.notification?.body;
  if (!title && !body) return;

  await configureForegroundNotificationHandler();
  const notifications = await import("expo-notifications");
  await notifications.scheduleNotificationAsync({
    identifier: message.messageId,
    content: {
      title: title ?? "Tamalife",
      body: body ?? "Penny has an update for you.",
      data: message.data ?? {},
      sound: "default",
      color: "#F3A6C0",
    },
    trigger: Platform.OS === "android" ? { channelId: "reminders" } : null,
  });
}

export async function subscribeToLocalNotificationOpens(
  listener: (data: NotificationData) => void,
): Promise<() => void> {
  const notifications = await import("expo-notifications");
  const subscription = notifications.addNotificationResponseReceivedListener((response) => {
    listener(response.notification.request.content.data);
  });
  return () => subscription.remove();
}

export async function requestPushPermission(
  firebase: Awaited<ReturnType<typeof loadFirebaseMessaging>>,
): Promise<boolean> {
  if (Platform.OS === "android") {
    const notifications = await import("expo-notifications");
    await notifications.setNotificationChannelAsync("reminders", {
      name: "Renewal reminders",
      importance: notifications.AndroidImportance.HIGH,
      lightColor: "#F3A6C0",
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  if (Platform.OS === "android") return true;

  const status = await firebase.requestPermission(firebase.getMessaging());
  return (
    status === firebase.AuthorizationStatus.AUTHORIZED ||
    status === firebase.AuthorizationStatus.PROVISIONAL
  );
}

export async function unregisterCurrentPushToken(
  unregister: UnregisterPushToken,
): Promise<void> {
  if (Platform.OS === "web") return;

  const firebase = await loadFirebaseMessaging();
  const messaging = firebase.getMessaging();
  const token = await firebase.getToken(messaging);
  try {
    await unregister(token);
  } finally {
    // Invalidating the local token prevents notifications for the signed-out
    // account even if the backend request was interrupted. A future sign-in
    // receives and registers a fresh token.
    await firebase.deleteToken(messaging);
  }
}
