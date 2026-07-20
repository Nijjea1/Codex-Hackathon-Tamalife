import { useRouter } from "expo-router";
import { ChevronLeft, ShieldCheck } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { Creature } from "../../components/creatures/Creature";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { Screen } from "../../components/ui/Screen";
import { demoReceipt } from "../../data/mockSubscriptions";
import { useDemoModeStore } from "../../store/useDemoModeStore";
import { useReceiptDraftStore } from "../../store/useReceiptDraftStore";
import { useApiClient } from "../../lib/api";
import { useUIStore } from "../../store/useUIStore";

const scanSteps = [
  "Reading the receipt…",
  "Finding the renewal date…",
  "Checking the price…",
  "Creating your creature…",
];

export default function PasteScreen() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const demoMode = useDemoModeStore((s) => s.active);
  const setDraft = useReceiptDraftStore((s) => s.setDraft);
  const api = useApiClient();
  const showToast = useUIStore((s) => s.showToast);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const wobble = useSharedValue(0);

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const startScan = async () => {
    setScanning(true);
    setStepIndex(0);
    wobble.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 260, easing: Easing.inOut(Easing.sin) }),
        withTiming(6, { duration: 260, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    if (!demoMode) {
      try {
        const parsed = await api.parseText(text.trim());
        if (!parsed.extracted) throw new Error("We couldn't extract enough details. Please review the receipt text.");
        setDraft(parsed.id, parsed.extracted);
        router.push("/add/review");
      } catch (e) {
        showToast({ message: (e as Error).message, tone: "warning" });
      } finally {
        setScanning(false);
        wobble.value = 0;
      }
      return;
    }
    scanSteps.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStepIndex(i), i * 550));
    });
    timers.current.push(
      setTimeout(() => {
        router.push("/add/review");
        setScanning(false);
      }, scanSteps.length * 550 + 300)
    );
  };

  const eggStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wobble.value}deg` }],
  }));

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel="Go back"
          icon={<ChevronLeft size={22} color={colors.text} />}
          onPress={() => router.back()}
        />
        <Text style={type.title}>Paste your receipt</Text>
      </View>

      <TextInput
        style={styles.textArea}
        multiline
        placeholder="Paste a receipt, subscription confirmation or price-change email here..."
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={setText}
        textAlignVertical="top"
        accessibilityLabel="Receipt text"
        editable={!scanning}
      />
      <View style={styles.metaRow}>
        <Text style={type.caption}>{text.length} characters</Text>
        <Button
          label="Use demo receipt"
          variant="ghost"
          onPress={() => setText(demoReceipt)}
          style={{ minHeight: 0 }}
        />
      </View>

      <View style={styles.privacy}>
        <ShieldCheck size={16} color={colors.secondary} />
        <Text style={[type.bodySmall, { flex: 1 }]}>
          Your receipt will only be used to identify billing details.
        </Text>
      </View>

      <Button
        label="Find subscription"
        onPress={startScan}
        disabled={text.trim().length < 20}
        style={{ marginTop: spacing.md }}
      />

      {scanning && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.scanOverlay}>
          <Animated.View style={eggStyle}>
            <Creature species="egg" mood="healthy" size="large" />
          </Animated.View>
          <Text style={styles.scanStep}>{scanSteps[stepIndex]}</Text>
          <View style={styles.scanDots}>
            {scanSteps.map((_, i) => (
              <View
                key={i}
                style={[styles.scanDot, i <= stepIndex && { backgroundColor: colors.primary }]}
              />
            ))}
          </View>
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 190,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  privacy: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.secondarySoft,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginTop: spacing.sm,
  },
  scanOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  scanStep: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.text,
    marginTop: spacing.lg,
  },
  scanDots: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  scanDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: colors.surfaceRaised },
});
