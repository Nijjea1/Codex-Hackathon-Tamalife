import { useUser } from "@clerk/clerk-expo";
import { useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";

/**
 * Bridges Clerk's auth state into the app's Zustand store so existing screens
 * (which read `userName` / `isAuthenticated`) show the real signed-in user
 * without each screen needing to know about Clerk.
 */
export function ClerkSync() {
  const { isSignedIn, user } = useUser();
  const setUserName = useAuthStore((s) => s.setUserName);
  const signIn = useAuthStore((s) => s.signIn);

  useEffect(() => {
    if (isSignedIn && user) {
      const name =
        user.firstName ||
        user.fullName ||
        user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
        "friend";
      setUserName(name);
      signIn();
    }
  }, [isSignedIn, user, setUserName, signIn]);

  return null;
}
