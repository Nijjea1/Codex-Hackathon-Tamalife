import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ClipboardPaste, FileText, Image as ImageIcon, Mail, PencilLine, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
import { MascotPortrait } from "../../components/onboarding/MascotPortrait";
import { IconButton } from "../../components/ui/IconButton";
import { Screen } from "../../components/ui/Screen";
import { GardenKicker } from "../../components/ui/GardenKit";
import { useApiClient } from "../../lib/api";
import { mapSubscription } from "../../lib/mappers";
import { assignCreature } from "../../lib/creatureAssign";
import { ExtractedReceiptDto, ParseResponseDto } from "../../types/api";
import { useDemoModeStore } from "../../store/useDemoModeStore";
import { useReceiptDraftStore } from "../../store/useReceiptDraftStore";
import { useUIStore } from "../../store/useUIStore";

// Confidence at or above which we skip the review screen and hatch the
// creature immediately.
const AUTO_CREATE_CONFIDENCE = 0.7;

const scanSteps = [
  "Reading your receipt…",
  "Finding the renewal date…",
  "Checking the price…",
  "Waking up a creature…",
];

type Method = {
  title: string;
  description: string;
  icon: typeof ClipboardPaste;
  route?: "/add/paste" | "/add/manual";
  action?: "screenshot" | "file";
  comingSoon?: boolean;
};

const methods: Method[] = [
  {
    title: "Upload PDF or file",
    description: "Drop in a PDF or receipt file — we read it and hatch a creature automatically.",
    icon: FileText,
    action: "file",
  },
  {
    title: "Upload screenshot",
    description: "Snap your billing page and let us read it for you.",
    icon: ImageIcon,
    action: "screenshot",
  },
  {
    title: "Paste receipt or email",
    description: "Paste renewal or billing text and we'll fill in the details.",
    icon: ClipboardPaste,
    route: "/add/paste",
  },
  {
    title: "Add manually",
    description: "Enter the price and renewal date yourself.",
    icon: PencilLine,
    route: "/add/manual",
  },
  {
    title: "Connect email",
    description: "Find subscriptions automatically from receipts.",
    icon: Mail,
    comingSoon: true,
  },
];

export default function AddScreen() {
  const router = useRouter();
  const p = useGardenPalette();
  const api = useApiClient();
  const demoMode = useDemoModeStore((state) => state.active);
  const setDraft = useReceiptDraftStore((state) => state.setDraft);
  const setSubscription = useReceiptDraftStore((state) => state.setSubscription);
  const showToast = useUIStore((state) => state.showToast);
  const [busy, setBusy] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [bob]);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  useEffect(() => () => {
    if (stepTimer.current) clearInterval(stepTimer.current);
  }, []);

  const startScanAnimation = () => {
    setStepIndex(0);
    if (stepTimer.current) clearInterval(stepTimer.current);
    stepTimer.current = setInterval(() => {
      setStepIndex((i) => (i + 1) % scanSteps.length);
    }, 1400);
  };

  const stopScanAnimation = () => {
    if (stepTimer.current) clearInterval(stepTimer.current);
    stepTimer.current = null;
  };

  // Auto-create when the model is confident; otherwise drop to review so the
  // user can fix the details before hatching.
  const handleParsed = async (parsed: ParseResponseDto) => {
    const extracted: ExtractedReceiptDto | null = parsed.extracted;
    if (parsed.status === "completed" && extracted && extracted.confidence >= AUTO_CREATE_CONFIDENCE) {
      const { name, species } = assignCreature(extracted.category);
      const response = await api.confirmParse(parsed.id, extracted, name, species);
      setSubscription(mapSubscription(response.subscription));
      router.push("/add/success");
      return;
    }
    if (extracted) {
      setDraft(parsed.id, extracted);
      router.push("/add/review");
      return;
    }
    throw new Error("We couldn't read this receipt. Try a clearer file or add it manually.");
  };

  const runUpload = async (uri: string, name: string, type: string) => {
    if (demoMode) {
      showToast({ message: "Receipt reading uses the live API — sign in to try it.", tone: "warning" });
      return;
    }
    setBusy(true);
    startScanAnimation();
    try {
      const parsed = await api.parseImage(uri, name, type);
      await handleParsed(parsed);
    } catch (error) {
      showToast({ message: (error as Error).message, tone: "warning" });
    } finally {
      stopScanAnimation();
      setBusy(false);
    }
  };

  const pickScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({ message: "Photo access is required to choose a receipt.", tone: "warning" });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    await runUpload(asset.uri, asset.fileName ?? "receipt.jpg", asset.mimeType ?? "image/jpeg");
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    await runUpload(asset.uri, asset.name ?? "receipt.pdf", asset.mimeType ?? "application/pdf");
  };

  const onMethodPress = (method: Method) => {
    if (busy || method.comingSoon) return;
    if (method.action === "screenshot") void pickScreenshot();
    else if (method.action === "file") void pickFile();
    else if (method.route) router.push(method.route);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <GardenKicker>NEW FRIEND</GardenKicker>
          <Text style={[styles.title, { color: p.ink }]}>Bring an expense to life</Text>
        </View>
        <IconButton
          accessibilityLabel="Close"
          icon={<X size={20} color={p.pillInk} strokeWidth={2.5} />}
          onPress={() => router.back()}
        />
      </View>
      <View style={styles.companion}>
        <MascotPortrait id="penny" size={120} />
        <Text style={[styles.blurb, { color: p.body }]}>
          Upload a receipt and a creature hatches automatically — no typing needed.
        </Text>
      </View>

      {methods.map((method) => {
        const { title, description, icon: Icon, comingSoon } = method;
        return (
          <Pressable
            key={title}
            accessibilityRole="button"
            accessibilityLabel={comingSoon ? `${title}, coming soon` : title}
            disabled={comingSoon || busy}
            onPress={() => onMethodPress(method)}
            style={({ pressed }) => [
              styles.method,
              { backgroundColor: p.cardBg, borderColor: p.cardBorder, shadowColor: p.cardShadow },
              pressed && { transform: [{ translateY: 2 }] },
              comingSoon && { opacity: 0.55 },
            ]}
          >
            <View style={[styles.methodIcon, { backgroundColor: p.warningBg, borderColor: p.goldBorder }]}>
              <Icon size={22} color={comingSoon ? p.muted : p.accent} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.methodTitleRow}>
                <Text style={[styles.methodTitle, { color: p.ink }]}>{title}</Text>
                {comingSoon && (
                  <View style={[styles.soonBadge, { backgroundColor: p.warningBg, borderColor: p.warning }]}>
                    <Text style={[styles.soonText, { color: p.warning }]}>SOON</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.methodDesc, { color: p.body }]}>{description}</Text>
            </View>
          </Pressable>
        );
      })}

      {busy && (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.overlay, { backgroundColor: p.overlay }]}>
          <Animated.View style={bobStyle}>
            <MascotPortrait id="penny" size={150} />
          </Animated.View>
          <Text style={[styles.scanStep, { color: p.inkStrong }]}>{scanSteps[stepIndex]}</Text>
          <View style={styles.dots}>
            {scanSteps.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: p.pillBorder }, i <= stepIndex && { backgroundColor: p.gold }]}
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
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.pixelBold, fontSize: 22, letterSpacing: 0.5, marginTop: 2 },
  companion: { alignItems: "center", marginVertical: spacing.sm },
  blurb: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: spacing.sm, maxWidth: 300 },
  method: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 2.5,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    minHeight: 84,
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 0,
    elevation: 3,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  methodTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  methodTitle: { fontFamily: fonts.pixelBold, fontSize: 15 },
  methodDesc: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  soonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  soonText: { fontFamily: "monospace", fontWeight: "900", fontSize: 8, letterSpacing: 0.5 },
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  scanStep: { fontFamily: fonts.pixelBold, fontSize: 17, marginTop: spacing.lg, textAlign: "center" },
  dots: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 8 },
});
