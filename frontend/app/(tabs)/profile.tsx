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
  Lock,
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
import { useApiClient } from "../../lib/api";
import { unregisterCurrentPushToken } from "../../lib/pushNotifications";
import { portfolioStats } from "../../lib/portfolio";
import { useSubscriptionData } from "../../lib/useSubscriptionData";
import { useAuthStore } from "../../store/useAuthStore";
import { useDemoModeStore } from "../../store/useDemoModeStore";
import { useUIStore } from "../../store/useUIStore";

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
  const api = useApiClient();
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
  const [exporting, setExporting] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);

  const handleSignOut = async () => {
    try {
      if (demoMode) {
        leaveDemo();
      } else {
        await unregisterCurrentPushToken(api.unregisterPushToken).catch(() => {});
        await clerkSignOut();
      }
    } catch {
      // Ignore sign-out errors; local state still needs to be cleared.
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
    } else if (label === "Help") {
      router.push("/help");
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

  // Creature friends unlock as the garden grows — all derived from real data.
  const resolvedCount = subscriptions.filter((s) => s.status === "cancelled" || s.status === "renewed").length;
  const friends = [
    { id: "rolo", name: "Rolo", requirement: "Track 3 subscriptions", current: Math.min(stats.count, 3), goal: 3, unlocked: stats.count >= 3 },
    { id: "twinkle", name: "Twinkle", requirement: "Reach Level 3", current: Math.min(stats.level, 3), goal: 3, unlocked: stats.level >= 3 },
    { id: "bucky", name: "Bucky", requirement: "Resolve 3 renewals", current: Math.min(resolvedCount, 3), goal: 3, unlocked: resolvedCount >= 3 },
  ];
  const unlockedCount = friends.filter((f) => f.unlocked).length;

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

      <SectionHeader title="Creature friends" />
      <Card style={{ gap: spacing.sm }}>
        <Text style={[styles.collectionLead, { color: p.body }]}>
          Grow your garden to unlock new friends — you've unlocked {unlockedCount}/{friends.length}.
          Here's how to meet the rest:
        </Text>
        {friends.map((f) => (
          <View key={f.id} style={[styles.friendRow, { borderTopWidth: 1.5, borderTopColor: p.cardBorder }]}>
            <View style={[styles.friendPortrait, { opacity: f.unlocked ? 1 : 0.9 }]}>
              <MascotPortrait id={f.id} size={56} />
              {!f.unlocked && <View style={[styles.friendCover, { backgroundColor: p.cardBgSolid }]} />}
              {!f.unlocked && (
                <View style={styles.lockBadge}>
                  <Lock size={14} color={p.muted} strokeWidth={2.6} />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.friendName, { color: f.unlocked ? p.ink : p.muted }]}>
                {f.unlocked ? f.name : "???"}
              </Text>
              {f.unlocked ? (
                <Text style={[styles.friendReq, { color: p.success }]}>Unlocked!</Text>
              ) : (
                <>
                  <Text style={[styles.friendReq, { color: p.body }]}>
                    {f.requirement} · {f.current}/{f.goal}
                  </Text>
                  <View style={[styles.progressTrack, { backgroundColor: p.warningBg }]}>
                    <View style={[styles.progressFill, { backgroundColor: p.gold, width: `${(f.current / f.goal) * 100}%` }]} />
                  </View>
                </>
              )}
            </View>
          </View>
        ))}
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
  collectionLead: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
  friendRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.sm },
  friendPortrait: { width: 56, height: 56, borderRadius: 12, overflow: "hidden", justifyContent: "center", alignItems: "center" },
  friendCover: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.82, borderRadius: 12 },
  lockBadge: { position: "absolute" },
  friendName: { fontFamily: fonts.pixelBold, fontSize: 15 },
  friendReq: { fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  progressTrack: { height: 8, borderRadius: 6, overflow: "hidden", marginTop: 6 },
  progressFill: { height: "100%", borderRadius: 6 },
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
