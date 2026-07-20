import { useRouter } from "expo-router";
import { Search, SlidersHorizontal } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { GardenScene } from "../../components/garden/GardenScene";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { SubscriptionCard } from "../../components/subscription/SubscriptionCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconButton } from "../../components/ui/IconButton";
import { Chip } from "../../components/ui/Chip";
import { Screen } from "../../components/ui/Screen";
import { colors, spacing, type } from "../../constants/theme";
import { useSubscriptionData } from "../../lib/useSubscriptionData";
import { AmbienceButton } from "../../components/onboarding/GardenAmbience";
import { GardenModeButton } from "../../components/onboarding/GardenModeButton";
import { GardenKicker } from "../../components/ui/GardenKit";
import { useUIStore } from "../../store/useUIStore";
import { CreatureMood } from "../../types/subscription";

type Filter = "All" | "Happy" | "Needs attention" | "Critical" | "Resolved";
const filters: Filter[] = ["All", "Happy", "Needs attention", "Critical", "Resolved"];

const filterMoods: Record<Exclude<Filter, "All">, CreatureMood[]> = {
  Happy: ["happy", "healthy"],
  "Needs attention": ["concerned", "sick"],
  Critical: ["critical"],
  Resolved: ["resolved", "reviving"],
};

export default function GardenScreen() {
  const router = useRouter();
  const p = useGardenPalette();
  const { subscriptions, loading, error, resolve: resolveSubscription } = useSubscriptionData();
  const showToast = useUIStore((s) => s.showToast);
  const [filter, setFilter] = useState<Filter>("All");

  const filtered =
    filter === "All"
      ? subscriptions
      : subscriptions.filter((s) => filterMoods[filter].includes(s.mood));

  return (
    <Screen scroll={false} contentStyle={styles.screenContent}>
      <View style={styles.header}>
        <View>
          <GardenKicker>TODAY'S GARDEN</GardenKicker>
          <Text style={[styles.title, { color: p.ink }]}>My Garden</Text>
          <Text style={[styles.sub, { color: p.body }]}>{subscriptions.length} creatures growing</Text>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <AmbienceButton compact />
          <GardenModeButton compact />
        </View>
      </View>
      <View style={styles.toolRow}>
        <IconButton
          accessibilityLabel="Filter creatures"
          icon={<SlidersHorizontal size={18} color={p.pillInk} strokeWidth={2.4} />}
          onPress={() => showToast({ message: "Use the chips below to filter", tone: "info" })}
        />
        <IconButton
          accessibilityLabel="Search creatures"
          icon={<Search size={18} color={p.pillInk} strokeWidth={2.4} />}
          onPress={() => showToast({ message: "Search is coming soon", tone: "info" })}
        />
      </View>
      {loading && <Text style={[styles.status, { color: p.muted }]}>Loading subscriptions…</Text>}
      {error && <Text style={[styles.status, { color: p.danger }]}>{error}</Text>}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroller}
      >
        {filters.map((f) => (
          <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <EmptyState
          title="No creatures here"
          message="Nothing matches this filter right now — which is usually good news."
          actionLabel="Show all creatures"
          onAction={() => setFilter("All")}
        />
      ) : (
        <GardenScene
          subscriptions={filtered}
          onCreatureOpen={(id) => router.push(`/creature/${id}`)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  error: {
    color: colors.warning,
  },
  chipScroller: {
    flexGrow: 0,
    marginBottom: spacing.md,
  },
  chips: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  title: { fontFamily: fonts.pixelBold, fontSize: 24, letterSpacing: 0.5, marginTop: 2 },
  sub: { fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  toolRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  status: { fontFamily: fonts.medium, fontSize: 13, marginBottom: spacing.sm },
  chips: { gap: spacing.sm, paddingRight: spacing.md },
  columns: { flexDirection: "row", gap: spacing.sm + 2 },
  column: { flex: 1, gap: spacing.sm + 2 },
});
