import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { FinancialSummary } from "../../components/dashboard/FinancialSummary";
import { GardenHero } from "../../components/dashboard/GardenHero";
import { QuickActions } from "../../components/dashboard/QuickActions";
import { RecentWinCard } from "../../components/dashboard/RecentWinCard";
import { RenewalRow } from "../../components/subscription/RenewalRow";
import { UrgentSubscriptionCard } from "../../components/subscription/UrgentSubscriptionCard";
import { IconButton } from "../../components/ui/IconButton";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAuthStore } from "../../store/useAuthStore";
import { useSubscriptionStore } from "../../store/useSubscriptionStore";
import { useUIStore } from "../../store/useUIStore";
import { useSubscriptionData } from "../../lib/useSubscriptionData";
import { useApiClient } from "../../lib/api";
import { DashboardSummaryDto } from "../../types/api";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const router = useRouter();
  const userName = useAuthStore((s) => s.userName);
  const { subscriptions, loading, error, resolve: resolveSubscription, demo } = useSubscriptionData();
  const lastSaving = useSubscriptionStore((s) => s.lastSaving);
  const showToast = useUIStore((s) => s.showToast);
  const api = useApiClient();
  const [summary, setSummary] = React.useState<DashboardSummaryDto | null>(null);

  React.useEffect(() => {
    if (demo) return;
    api.dashboardSummary().then(setSummary).catch((e) =>
      showToast({ message: (e as Error).message, tone: "warning" })
    );
  }, [api, demo, showToast]);

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
      {loading && <Text style={type.bodySmall}>Loading your gardenâ€¦</Text>}
      {error && <Text style={[type.bodySmall, { color: colors.warning }]}>{error}</Text>}
      <View style={styles.topBar}>
        <View>
          <Text style={type.title}>
            {greeting()}, {userName}
          </Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Garden Lv. 3</Text>
          </View>
        </View>
        <IconButton
          accessibilityLabel="Notifications, 1 unread"
          icon={<Bell size={20} color={colors.text} />}
          badge
          onPress={() => showToast({ message: "Notifications are mocked in this demo", tone: "info" })}
        />
      </View>

      <GardenHero
        subscriptions={subscriptions}
        onCreaturePress={(id) => router.push(`/creature/${id}`)}
      />

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
    alignItems: "center",
    marginBottom: spacing.md,
  },
  levelBadge: {
    backgroundColor: colors.primarySoft,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginTop: 6,
  },
  levelText: { fontFamily: fonts.bold, fontSize: 11, color: colors.primaryLight },
});
