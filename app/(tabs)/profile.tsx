import { useClerk } from "@clerk/clerk-expo";
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
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { AccountCard } from "../../components/AccountCard";
import { Creature } from "../../components/creatures/Creature";
import { Card } from "../../components/ui/Card";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuthStore } from "../../store/useAuthStore";
import { useUIStore } from "../../store/useUIStore";
import { CreatureSpecies } from "../../types/subscription";

const starterSpecies: Record<string, CreatureSpecies> = {
  sprout: "sprout",
  glint: "gem",
  puff: "cloud",
};

const lockedSpecies: { name: string; species: CreatureSpecies }[] = [
  { name: "???", species: "ember" },
  { name: "???", species: "blob" },
  { name: "???", species: "egg" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut: clerkSignOut } = useClerk();
  const userName = useAuthStore((s) => s.userName);
  const selectedStarter = useAuthStore((s) => s.selectedStarter);
  const signOut = useAuthStore((s) => s.signOut);
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const setReducedMotion = useUIStore((s) => s.setReducedMotion);
  const showToast = useUIStore((s) => s.showToast);

  const handleSignOut = async () => {
    try {
      await clerkSignOut();
    } catch {
      // ignore — demo sessions have no Clerk session to end
    }
    signOut();
    router.replace("/");
  };

  const species = starterSpecies[selectedStarter ?? "sprout"] ?? "sprout";

  const rows = [
    { icon: Bell, label: "Notification preferences", note: "14, 7 and 1 day reminders" },
    { icon: Palette, label: "Appearance", note: "Dark (default)" },
    { icon: CircleDollarSign, label: "Currency", note: "USD $" },
    { icon: Lock, label: "Security", note: "Coming soon" },
    { icon: Download, label: "Export data", note: "Coming soon" },
    { icon: HelpCircle, label: "Help", note: "FAQs and support" },
  ];

  return (
    <Screen>
      <Text style={type.title}>Profile</Text>

      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{userName}</Text>
          <Text style={type.bodySmall}>Garden Lv. 3 · 5 creatures</Text>
        </View>
        <View style={{ transform: [{ scale: 0.75 }] }}>
          <Creature species={species} mood="happy" size="small" />
        </View>
      </Card>

      <AccountCard />

      <SectionHeader title="Settings" />
      <Card style={{ paddingVertical: 4 }}>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Palette size={18} color={colors.primaryLight} />
          </View>
          <Text style={[styles.rowLabel, { flex: 1 }]}>Reduce motion</Text>
          <Switch
            value={reducedMotion}
            onValueChange={setReducedMotion}
            trackColor={{ true: colors.primary, false: colors.surfaceRaised }}
            thumbColor={colors.text}
            accessibilityLabel="Reduce motion"
          />
        </View>
        {rows.map(({ icon: Icon, label, note }) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => showToast({ message: `${label} is mocked in this demo`, tone: "info" })}
            style={({ pressed }) => [styles.row, styles.rowBorder, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.rowIcon}>
              <Icon size={18} color={colors.primaryLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={type.caption}>{note}</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </Card>

      <SectionHeader title="Creature collection" />
      <Card>
        <Text style={[type.bodySmall, { marginBottom: spacing.sm }]}>
          Future species you haven't met yet.
        </Text>
        <View style={styles.lockedRow}>
          {lockedSpecies.map((l, i) => (
            <View key={i} style={styles.lockedSlot}>
              <View style={styles.silhouette}>
                <Creature species={l.species} mood="resolved" size="small" />
                <View style={styles.silhouetteCover} />
              </View>
              <Text style={type.caption}>{l.name}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={handleSignOut}
        style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}
      >
        <LogOut size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.extraBold, fontSize: 22, color: colors.primaryLight },
  profileName: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm + 4,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  lockedRow: { flexDirection: "row", gap: spacing.md },
  lockedSlot: { alignItems: "center", gap: 4 },
  silhouette: { position: "relative" },
  silhouetteCover: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface,
    opacity: 0.82,
    borderRadius: 12,
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(240,106,120,0.3)",
  },
  signOutText: { fontFamily: fonts.bold, fontSize: 15, color: colors.danger },
});
