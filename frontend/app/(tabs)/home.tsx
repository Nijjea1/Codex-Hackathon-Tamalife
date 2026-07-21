import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { FinancialSummary } from "../../components/dashboard/FinancialSummary";
import { GardenHero } from "../../components/dashboard/GardenHero";
import { QuickActions } from "../../components/dashboard/QuickActions";
import { RecentWinCard } from "../../components/dashboard/RecentWinCard";
import { RenewalRow } from "../../components/subscription/RenewalRow";
import { UrgentSubscriptionCard } from "../../components/subscription/UrgentSubscriptionCard";
import { AmbienceButton } from "../../components/onboarding/GardenAmbience";
import { GardenModeButton } from "../../components/onboarding/GardenModeButton";
import { MascotPortrait } from "../../components/onboarding/MascotPortrait";
import { IconButton } from "../../components/ui/IconButton";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { GardenKicker } from "../../components/ui/GardenKit";
import { useAuthStore } from "../../store/useAuthStore";
import { useSubscriptionStore } from "../../store/useSubscriptionStore";
import { useUIStore } from "../../store/useUIStore";
import { useSubscriptionData } from "../../lib/useSubscriptionData";
import { useApiClient } from "../../lib/api";
import { DashboardSummaryDto } from "../../types/api";
import { useForegroundRefresh } from "../../lib/useForegroundRefresh";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const router = useRouter();
  const p = useGardenPalette();
  const userName = useAuthStore((s) => s.userName);
  const { subscriptions, loading, error, resolve: resolveSubscription, demo } = useSubscriptionData();
  const lastSaving = useSubscriptionStore((s) => s.lastSaving);
  const showToast = useUIStore((s) => s.showToast);
  const api = useApiClient();
  const [summary, setSummary] = React.useState<DashboardSummaryDto | null>(null);

  const loadSummary = React.useCallback(async () => {
    if (demo) return;
    try {
      setSummary(await api.dashboardSummary());
    } catch (e) {
      showToast({ message: (e as Error).message, tone: "warning" });
    }
  }, [api, demo, showToast]);

  React.useEffect(() => { void loadSummary(); }, [loadSummary]);
  useForegroundRefresh(loadSummary, !demo);

  const active = subscriptions.filter((s) => s.status !== "cancelled");
  const localMonthly = active.reduce(
    (sum, s) => sum + (s.billingInterval === "yearly" ? s.price / 12 : s.price),
    0
  );
  const localAnnual = active.reduce((sum, s) => sum + s.annualCost, 0);
  const monthly = summary ? Number(summary.monthly_cost) : localMonthly;
  const annual = summary ? Number(summary.annual_cost) : localAnnual;

  const urgent = [...subscriptions]
    .filter((s) => s.status === "active" && ["sick", "critical"].includes(s.mood))
    .sort((a, b) => a.daysRemaining - b.daysRemaining)[0];

  const upcoming = [...subscriptions]
    .filter((s) => s.status === "active")
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 3);

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={styles.greetingRow}>
          <View style={[styles.mascotRing, { borderColor: p.pillBorder, backgroundColor: p.pill }]}>
            <MascotPortrait id="penny" size={46} />
          </View>
          <View>
            <GardenKicker>{greeting().toUpperCase()}</GardenKicker>
            <Text style={[styles.name, { color: p.ink }]}>{userName}</Text>
            <View style={[styles.levelBadge, { backgroundColor: p.warningBg, borderColor: p.goldBorder }]}>
              <Text style={[styles.levelText, { color: p.accent }]}>GARDEN LV. 3</Text>
            </View>
          </View>
        </View>
        <View style={styles.controls}>
          <IconButton
            accessibilityLabel="Notifications, 1 unread"
            icon={<Bell size={20} color={p.pillInk} strokeWidth={2.4} />}
            badge
            onPress={() => router.push("/notification-preferences")}
          />
        </View>
      </View>

      <View style={styles.miniControls}>
        <AmbienceButton compact />
        <GardenModeButton compact />
      </View>

      {loading && <Text style={[styles.status, { color: p.muted }]}>Loading your garden…</Text>}
      {error && <Text style={[styles.status, { color: p.danger }]}>{error}</Text>}

      <Animated.View entering={FadeInDown.duration(480)}>
        <GardenHero
          subscriptions={subscriptions}
          onCreaturePress={(id) => router.push(`/creature/${id}`)}
        />
      </Animated.View>

      <View style={{ marginTop: spacing.md }}>
        <FinancialSummary monthly={monthly} annual={annual} />
      </View>

      {urgent && (
        <>
          <SectionHeader title="Needs attention" />
          <UrgentSubscriptionCard
            subscription={urgent}
            onReview={() => router.push(`/creature/${urgent.id}`)}
            onSnooze={() => {
              void resolveSubscription(urgent.id, "snooze").catch((e) =>
                showToast({ message: (e as Error).message, tone: "warning" })
              );
              showToast({ message: `We'll remind you about ${urgent.merchant} in 3 days`, tone: "info" });
            }}
          />
        </>
      )}

      <SectionHeader
        title="Upcoming renewals"
        actionLabel="See all"
        onAction={() => router.push("/(tabs)/garden")}
      />
      {upcoming.map((s) => (
        <RenewalRow key={s.id} subscription={s} onPress={() => router.push(`/creature/${s.id}`)} />
      ))}

      <SectionHeader title="Quick actions" />
      <QuickActions
        onAdd={() => router.push("/add")}
        onPaste={() => router.push("/add/paste")}
        onPriceChanges={() => router.push("/(tabs)/insights")}
        onViewAll={() => router.push("/(tabs)/garden")}
      />

      {demo && lastSaving && (
        <View style={{ marginTop: spacing.lg }}>
          <RecentWinCard merchant={lastSaving.merchant} annualAmount={lastSaving.annualAmount} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  greetingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, flex: 1 },
  mascotRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  name: { fontFamily: fonts.pixelBold, fontSize: 22, letterSpacing: 0.5, marginTop: 1 },
  levelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1.5,
    marginTop: 5,
  },
  levelText: { fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.5 },
  controls: { flexDirection: "row", alignItems: "center", gap: 7 },
  miniControls: { flexDirection: "row", justifyContent: "flex-end", gap: 7, marginBottom: spacing.sm },
  status: { fontFamily: fonts.medium, fontSize: 13, marginBottom: spacing.sm },
});
