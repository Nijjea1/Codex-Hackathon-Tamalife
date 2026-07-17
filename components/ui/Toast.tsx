import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, Info, AlertTriangle } from "lucide-react-native";
import { colors, fonts, radius, spacing } from "../../constants/theme";
import { useUIStore } from "../../store/useUIStore";

export function ToastHost() {
  const toast = useUIStore((s) => s.toast);
  const hideToast = useUIStore((s) => s.hideToast);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hideToast, 2600);
    return () => clearTimeout(t);
  }, [toast, hideToast]);

  if (!toast) return null;
  const Icon =
    toast.tone === "success" ? CheckCircle2 : toast.tone === "warning" ? AlertTriangle : Info;
  const tint =
    toast.tone === "success" ? colors.success : toast.tone === "warning" ? colors.warning : colors.primaryLight;

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(16)}
      exiting={FadeOutUp}
      style={[styles.wrap, { top: insets.top + 8 }]}
      pointerEvents="none"
    >
      <View style={styles.toast}>
        <Icon size={18} color={tint} />
        <Text style={styles.text}>{toast.message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 100 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    maxWidth: "88%",
  },
  text: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
});
