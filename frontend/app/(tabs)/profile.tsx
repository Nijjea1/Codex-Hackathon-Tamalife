import { useClerk } from "@clerk/expo";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  Bell,
  ChevronRight,
  CircleDollarSign,
  Download,
  HelpCircle,
  LogOut,
  Palette,
} from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { AccountCard } from "../../components/AccountCard";
import { MascotPortrait } from "../../components/onboarding/MascotPortrait";
import { AmbienceButton } from "../../components/onboarding/GardenAmbience";
import { GardenModeButton } from "../../components/onboarding/GardenModeButton";
import { Card } from "../../components/ui/Card";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { GardenKicker } from "../../components/ui/GardenKit";
import { useAuthStore } from "../../store/useAuthStore";
import { useUIStore } from "../../store/useUIStore";
import { useDemoModeStore } from "../../store/useDemoModeStore";
import { useSubscriptionData } from "../../lib/useSubscriptionData";
import { useApiClient } from "../../lib/api";
import { portfolioStats } from "../../lib/portfolio";

const lockedMascots: { name: string; id: string }[] = [
  { name: "???", id: "rolo" },
  { name: "???", id: "twinkle" },
  { name: "???", id: "bucky" },
];

const currencyOptions = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "CAD", label: "Canadian Dollar", symbol: "CA$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
] as const;

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

export default function ProfileScreen() {
  const router = useRouter();
  const p = useGardenPalette();
  const { signOut: clerkSignOut } = useClerk();
  const userName = useAuthStore((s) => s.userName);
  const selectedStarter = useAuthStore((s) => s.selectedStarter);
  const resetLocalState = useAuthStore((s) => s.resetLocalState);
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const setReducedMotion = useUIStore((s) => s.setReducedMotion);
  const currency = useUIStore((s) => s.currency);
  const setCurrency = useUIStore((s) => s.setCurrency);
  const onboardingTheme = useUIStore((s) => s.onboardingTheme);
  const setOnboardingTheme = useUIStore((s) => s.setOnboardingTheme);
  const showToast = useUIStore((s) => s.showToast);
  const demoMode = useDemoModeStore((s) => s.active);
  const leaveDemo = useDemoModeStore((s) => s.leave);
  const { subscriptions } = useSubscriptionData();
  const stats = portfolioStats(subscriptions);
  const api = useApiClient();
  const [exporting, setExporting] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);

  const handleSignOut = async () => {
    try {
      if (demoMode) {
        leaveDemo();
      } else {
        await clerkSignOut();
      }
    } catch {
      // ignore — demo sessions have no Clerk session to end
    }
    resetLocalState();
    router.replace("/");
  };

  const mascotId = selectedStarter ?? "penny";

  const rows = [
    { icon: Bell, label: "Notification preferences", note: "14, 7 and 1 day reminders" },
    { icon: Palette, label: "Appearance", note: onboardingTheme === "day" ? "Day mode" : "Night mode" },
    { icon: CircleDollarSign, label: "Currency", note: `${currency} · used for new subscriptions` },
    { icon: Download, label: "Export data", note: exporting ? "Preparing your PDF…" : "Create a PDF copy of your data" },
    { icon: HelpCircle, label: "Help", note: "FAQs and support" },
  ];

  const onRowPress = async (label: string) => {
    if (label === "Notification preferences") {
      router.push("/notification-preferences");
    } else if (label === "Appearance") {
      setOnboardingTheme(onboardingTheme === "day" ? "night" : "day");
    } else if (label === "Currency") {
      setCurrencyPickerVisible(true);
    } else if (label === "Export data") {
      if (demoMode) {
        showToast({ message: "Sign in to export your personal data", tone: "info" });
        return;
      }
      setExporting(true);
      try {
        const data = await api.exportMyData();
        const exportedAt = new Date().toLocaleString();
        const html = `<!doctype html><html><head><meta charset="utf-8" /><style>
          body { font-family: Arial, sans-serif; color: #1f2937; padding: 28px; }
          h1 { color: #31543c; margin-bottom: 4px; } p { color: #4b5563; }
          pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f8fafc; border: 1px solid #d1d5db; border-radius: 8px; padding: 14px; font-size: 9px; }
        </style></head><body><h1>Tamalife data export</h1><p>Created ${escapeHtml(exportedAt)}</p><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre></body></html>`;
        if (Platform.OS === "web") {
          await Print.printAsync({ html });
        } else {
          const { uri } = await Print.printToFileAsync({ html });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Save Tamalife data export" });
          }
        }
        showToast({ message: "Your PDF export is ready", tone: "success" });
      } catch (error) {
        showToast({ message: (error as Error).message, tone: "warning" });
      } finally {
        setExporting(false);
      }
    } else {
      showToast({ message: `${label} is not available yet`, tone: "info" });
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <GardenKicker>YOUR PROFILE</GardenKicker>
          <Text style={[styles.title, { color: p.ink }]}>Profile</Text>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <AmbienceButton compact />
          <GardenModeButton compact />
        </View>
      </View>

      <Card style={styles.profileCard}>
        <View style={[styles.avatar, { borderColor: p.pillBorder, backgroundColor: p.pill }]}>
          <MascotPortrait id={mascotId} size={54} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.profileName, { color: p.ink }]}>{userName}</Text>
          <Text style={[styles.profileSub, { color: p.body }]}>
            Lv. {stats.level} {stats.levelLabel} · {stats.count} creature{stats.count === 1 ? "" : "s"}
          </Text>
        </View>
      </Card>

      <Modal
        transparent
        visible={currencyPickerVisible}
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={() => setCurrencyPickerVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCurrencyPickerVisible(false)}>
          <Pressable
            style={[styles.currencyPicker, { backgroundColor: p.cardBgSolid, borderColor: p.cardBorder }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.currencyTitle, { color: p.ink }]}>Choose currency</Text>
            <Text style={[styles.rowNote, { color: p.body }]}>Used when you add a new subscription.</Text>
            {currencyOptions.map((option) => (
              <Pressable
                key={option.code}
                accessibilityRole="radio"
                accessibilityState={{ checked: currency === option.code }}
                onPress={() => {
                  setCurrency(option.code);
                  setCurrencyPickerVisible(false);
                  showToast({ message: `Currency set to ${option.code}`, tone: "success" });
                }}
                style={[
                  styles.currencyOption,
                  { borderColor: p.cardBorder },
                  currency === option.code && { backgroundColor: p.warningBg, borderColor: p.goldBorder },
                ]}
              >
                <Text style={[styles.currencyCode, { color: p.ink }]}>{option.symbol} {option.code}</Text>
                <Text style={[styles.rowNote, { color: p.body }]}>{option.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <AccountCard />

      <SectionHeader title="Settings" />
      <Card style={{ paddingVertical: 4 }}>
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: p.warningBg, borderColor: p.goldBorder }]}>
            <Palette size={18} color={p.accent} strokeWidth={2.4} />
          </View>
          <Text style={[styles.rowLabel, { flex: 1, color: p.ink }]}>Reduce motion</Text>
          <Switch
            value={reducedMotion}
            onValueChange={setReducedMotion}
            trackColor={{ true: p.gold, false: p.pillBorder }}
            thumbColor={p.cardBgSolid}
            accessibilityLabel="Reduce motion"
          />
        </View>
        {rows.map(({ icon: Icon, label, note }) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => void onRowPress(label)}
            style={({ pressed }) => [styles.row, { borderTopWidth: 1.5, borderTopColor: p.cardBorder }, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.rowIcon, { backgroundColor: p.warningBg, borderColor: p.goldBorder }]}>
              <Icon size={18} color={p.accent} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: p.ink }]}>{label}</Text>
              <Text style={[styles.rowNote, { color: p.muted }]}>{note}</Text>
            </View>
            <ChevronRight size={18} color={p.muted} />
          </Pressable>
        ))}
      </Card>

      <SectionHeader title="Creature collection" />
      <Card>
        <Text style={[styles.rowNote, { color: p.body, marginBottom: spacing.sm, fontSize: 13 }]}>
          Future friends you haven't met yet.
        </Text>
        <View style={styles.lockedRow}>
          {lockedMascots.map((l, i) => (
            <View key={i} style={styles.lockedSlot}>
              <View style={styles.silhouette}>
                <MascotPortrait id={l.id} size={64} />
                <View style={[styles.silhouetteCover, { backgroundColor: p.cardBgSolid }]} />
              </View>
              <Text style={[styles.rowNote, { color: p.muted }]}>{l.name}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={handleSignOut}
        style={({ pressed }) => [styles.signOut, { borderColor: p.danger, backgroundColor: p.dangerBg }, pressed && { transform: [{ translateY: 2 }] }]}
      >
        <LogOut size={18} color={p.danger} strokeWidth={2.4} />
        <Text style={[styles.signOutText, { color: p.danger }]}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.pixelBold, fontSize: 24, letterSpacing: 0.5, marginTop: 2 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileName: { fontFamily: fonts.pixelBold, fontSize: 18 },
  profileSub: { fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm + 4,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontFamily: fonts.pixelBold, fontSize: 14 },
  rowNote: { fontFamily: fonts.medium, fontSize: 11 },
  lockedRow: { flexDirection: "row", gap: spacing.md },
  lockedSlot: { alignItems: "center", gap: 4 },
  silhouette: { position: "relative", borderRadius: 12, overflow: "hidden" },
  silhouetteCover: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.8,
    borderRadius: 12,
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 2,
  },
  signOutText: { fontFamily: fonts.pixelBold, fontSize: 15 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(12, 9, 34, 0.55)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  currencyPicker: { width: "100%", maxWidth: 420, borderWidth: 2, borderRadius: 18, padding: spacing.lg, gap: spacing.sm },
  currencyTitle: { fontFamily: fonts.pixelBold, fontSize: 18 },
  currencyOption: { borderWidth: 1.5, borderRadius: 12, padding: spacing.sm + 2, gap: 2 },
  currencyCode: { fontFamily: fonts.pixelBold, fontSize: 14 },
});
