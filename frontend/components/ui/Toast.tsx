import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, Info, AlertTriangle } from "lucide-react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { useUIStore } from "../../store/useUIStore";

export function ToastHost() {
  const p = useGardenPalette();
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
    toast.tone === "success" ? p.success : toast.tone === "warning" ? p.warning : p.accent;

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(16)}
      exiting={FadeOutUp}
      style={[styles.wrap, { top: insets.top + 8 }]}
      pointerEvents="none"
    >
      <View style={[styles.toast, { backgroundColor: p.cardBgSolid, borderColor: p.cardBorder, shadowColor: p.cardShadow }]}>
        <Icon size={18} color={tint} strokeWidth={2.4} />
        <Text style={[styles.text, { color: p.ink }]}>{toast.message}</Text>
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
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    maxWidth: "88%",
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 4,
  },
  text: { fontFamily: fonts.pixel, fontSize: 13 },
});
