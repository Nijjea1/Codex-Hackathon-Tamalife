import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Where Clerk stores the session token between app launches.
 * Native: expo-secure-store (encrypted keychain / keystore).
 * Web: localStorage (SecureStore isn't available in the browser).
 */
export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      if (Platform.OS === "web") {
        return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === "web") {
        if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Non-fatal: a failed cache write just means the user re-authenticates.
    }
  },
};
