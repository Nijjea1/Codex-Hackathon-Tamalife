import { useUser } from "@clerk/expo";
import { useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";

/**
 * Copies only the non-sensitive display name into local UI preferences.
 */
export function ClerkSync() {
  const { isSignedIn, user } = useUser();
  const setUserName = useAuthStore((s) => s.setUserName);

  useEffect(() => {
    if (isSignedIn && user) {
      const name =
        user.firstName ||
        user.fullName ||
        user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
        "friend";
      setUserName(name);
    } else if (isSignedIn === false) {
      setUserName("Friend");
    }
  }, [isSignedIn, user, setUserName]);

  return null;
}
