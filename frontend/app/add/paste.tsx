import { useRouter } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
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
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { Creature } from "../../components/creatures/Creature";
import { Button } from "../../components/ui/Button";
import { GardenScreen } from "../../components/ui/GardenScreen";
import { GardenKicker } from "../../components/ui/GardenKit";
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
  const p = useGardenPalette();
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
    <GardenScreen title="Paste receipt" onBack={() => router.back()}>
      <GardenKicker>MAGIC READER</GardenKicker>
      <Text style={[styles.lead, { color: p.body }]}>
        Paste a receipt or billing email and Penny will fill in the details.
      </Text>

      <TextInput
        style={[styles.textArea, { backgroundColor: p.inputBg, borderColor: p.inputBorder, color: p.inputInk }]}
        multiline
        placeholder="Paste a receipt, subscription confirmation or price-change email here..."
        placeholderTextColor={p.muted}
        value={text}
        onChangeText={setText}
        textAlignVertical="top"
        accessibilityLabel="Receipt text"
        editable={!scanning}
      />
      <View style={styles.metaRow}>
        <Text style={[styles.count, { color: p.muted }]}>{text.length} characters</Text>
        <Button
          label="Use demo receipt"
          variant="ghost"
          onPress={() => setText(demoReceipt)}
          style={{ minHeight: 0 }}
        />
      </View>

      <View style={[styles.privacy, { backgroundColor: p.successBg }]}>
        <ShieldCheck size={16} color={p.success} strokeWidth={2.4} />
        <Text style={[styles.privacyText, { flex: 1, color: p.body }]}>
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
        <Animated.View entering={FadeIn.duration(250)} style={[styles.scanOverlay, { backgroundColor: p.overlay }]}>
          <Animated.View style={eggStyle}>
            <Creature species="egg" mood="healthy" size="large" />
          </Animated.View>
          <Text style={[styles.scanStep, { color: p.inkStrong }]}>{scanSteps[stepIndex]}</Text>
          <View style={styles.scanDots}>
            {scanSteps.map((_, i) => (
              <View
                key={i}
                style={[styles.scanDot, { backgroundColor: p.pillBorder }, i <= stepIndex && { backgroundColor: p.gold }]}
              />
            ))}
          </View>
        </Animated.View>
      )}
    </GardenScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: spacing.md },
  textArea: {
    borderWidth: 2,
    borderRadius: 14,
    padding: spacing.md,
    minHeight: 190,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  count: { fontFamily: "monospace", fontWeight: "900", fontSize: 10 },
  privacy: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 12,
    padding: spacing.sm + 4,
    marginTop: spacing.sm,
  },
  privacyText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  scanOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  scanStep: { fontFamily: fonts.pixelBold, fontSize: 17, marginTop: spacing.lg },
  scanDots: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  scanDot: { width: 8, height: 8, borderRadius: 8 },
});
