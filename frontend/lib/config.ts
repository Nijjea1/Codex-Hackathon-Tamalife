const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
if (!configuredApiUrl && !__DEV__) {
  throw new Error("EXPO_PUBLIC_API_URL is required in production builds.");
}

export const apiBaseUrl = (configuredApiUrl || "http://localhost:8000").replace(/\/+$/, "");

export const demoModeAvailable =
  __DEV__ && process.env.EXPO_PUBLIC_ENABLE_DEMO_MODE === "true";
