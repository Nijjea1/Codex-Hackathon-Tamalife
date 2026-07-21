import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/** Re-run remote state loading when the app returns from the background. */
export function useForegroundRefresh(refresh: () => void | Promise<void>, enabled = true) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshRef.current();
    });
    return () => subscription.remove();
  }, [enabled]);
}
