import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ClipboardPaste, Image as ImageIcon, Mail, PencilLine, X } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { MascotPortrait } from "../../components/onboarding/MascotPortrait";
import { IconButton } from "../../components/ui/IconButton";
import { Screen } from "../../components/ui/Screen";
import { GardenKicker } from "../../components/ui/GardenKit";
import { useApiClient } from "../../lib/api";
import { useDemoModeStore } from "../../store/useDemoModeStore";
import { useReceiptDraftStore } from "../../store/useReceiptDraftStore";
import { useUIStore } from "../../store/useUIStore";

type Method = {
  title: string;
  description: string;
  icon: typeof ClipboardPaste;
  route?: "/add/paste" | "/add/manual";
  upload?: boolean;
  comingSoon?: boolean;
};

const methods: Method[] = [
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
    title: "Upload screenshot",
    description: "Snap your billing page and let us read it.",
    icon: ImageIcon,
    upload: true,
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
  const showToast = useUIStore((state) => state.showToast);
  const [uploading, setUploading] = useState(false);

  const uploadScreenshot = async () => {
    if (demoMode) {
      showToast({ message: "Screenshot parsing uses the live API.", tone: "warning" });
      return;
    }
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
    setUploading(true);
    try {
      const parsed = await api.parseImage(
        asset.uri,
        asset.fileName ?? "receipt.jpg",
        asset.mimeType ?? "image/jpeg",
      );
      if (!parsed.extracted) {
        throw new Error("We couldn't confidently read this image. Try a clearer screenshot.");
      }
      setDraft(parsed.id, parsed.extracted);
      router.push("/add/review");
    } catch (error) {
      showToast({ message: (error as Error).message, tone: "warning" });
    } finally {
      setUploading(false);
    }
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
          Every expense you add becomes a creature in your garden.
        </Text>
      </View>

      {methods.map(({ title, description, icon: Icon, route, upload, comingSoon }) => (
        <Pressable
          key={title}
          accessibilityRole="button"
          accessibilityLabel={comingSoon ? `${title}, coming soon` : title}
          disabled={comingSoon || uploading}
          onPress={() => (upload ? void uploadScreenshot() : route && router.push(route))}
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
              {upload && uploading && (
                <View style={[styles.soonBadge, { backgroundColor: p.warningBg, borderColor: p.warning }]}>
                  <Text style={[styles.soonText, { color: p.warning }]}>READING…</Text>
                </View>
              )}
            </View>
            <Text style={[styles.methodDesc, { color: p.body }]}>{description}</Text>
          </View>
        </Pressable>
      ))}
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
});
