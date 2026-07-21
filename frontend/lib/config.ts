import Constants from "expo-constants";
import { Platform } from "react-native";

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
if (!configuredApiUrl && !__DEV__) {
  throw new Error("EXPO_PUBLIC_API_URL is required in production builds.");
}

const LOCALHOST_URL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

// The dev server (Metro) reports the LAN address the phone is already talking
// to, e.g. "192.168.2.154:8081". We reuse that host for the API so a physical
// device works without hardcoding an IP that breaks when the network changes.
function devServerHost(): string | null {
  const constants = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    expoGoConfig?: { debuggerHost?: string };
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
    manifest?: { debuggerHost?: string };
  };
  const uri =
    constants.expoConfig?.hostUri ??
    constants.expoGoConfig?.debuggerHost ??
    constants.manifest2?.extra?.expoGo?.debuggerHost ??
    constants.manifest?.debuggerHost ??
    null;
  const host = typeof uri === "string" ? uri.split(":")[0] : null;
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

function resolveApiBaseUrl(): string {
  // On a physical device in development, "localhost" points at the phone
  // itself — never the dev machine — so it can never reach the backend/DB.
  // When no explicit LAN/prod URL is set, derive the host from the dev server.
  const usingLocalDefault = !configuredApiUrl || LOCALHOST_URL.test(configuredApiUrl);
  if (__DEV__ && usingLocalDefault && Platform.OS !== "web") {
    const host = devServerHost();
    if (host) return `http://${host}:8000`;
  }
  return configuredApiUrl || "http://localhost:8000";
}

export const apiBaseUrl = resolveApiBaseUrl().replace(/\/+$/, "");

export const demoModeAvailable =
  __DEV__ && process.env.EXPO_PUBLIC_ENABLE_DEMO_MODE === "true";
