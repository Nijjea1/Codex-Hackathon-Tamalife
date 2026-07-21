import { useClerk } from "@clerk/expo";
import { useRouter } from "expo-router";
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
import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
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
import { portfolioStats } from "../../lib/portfolio";

const lockedMascots: { name: string; id: string }[] = [
  { name: "???", id: "rolo" },
  { name: "???", id: "twinkle" },
  { name: "???", id: "bucky" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const p = useGardenPalette();
  const { signOut: clerkSignOut } = useClerk();
  const userName = useAuthStore((s) => s.userName);
  const selectedStarter = useAuthStore((s) => s.selectedStarter);
  const resetLocalState = useAuthStore((s) => s.resetLocalState);
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const setReducedMotion = useUIStore((s) => s.setReducedMotion);
  const onboardingTheme = useUIStore((s) => s.onboardingTheme);
  const setOnboardingTheme = useUIStore((s) => s.setOnboardingTheme);
  const showToast = useUIStore((s) => s.showToast);
  const demoMode = useDemoModeStore((s) => s.active);
  const leaveDemo = useDemoModeStore((s) => s.leave);
  const { subscriptions } = useSubscriptionData();
  const stats = portfolioStats(subscriptions);

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
    { icon: CircleDollarSign, label: "Currency", note: "USD $" },
    { icon: Lock, label: "Security", note: "Coming soon" },
    { icon: Download, label: "Export data", note: "Coming soon" },
    { icon: HelpCircle, label: "Help", note: "FAQs and support" },
  ];

  const onRowPress = (label: string) => {
    if (label === "Notification preferences") {
      router.push("/notification-preferences");
    } else if (label === "Appearance") {
      setOnboardingTheme(onboardingTheme === "day" ? "night" : "day");
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
            onPress={() => onRowPress(label)}
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
});
