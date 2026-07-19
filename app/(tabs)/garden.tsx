import { useRouter } from "expo-router";
import { Search, SlidersHorizontal } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../../constants/theme";
import { GardenScene } from "../../components/garden/GardenScene";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconButton } from "../../components/ui/IconButton";
import { Chip } from "../../components/ui/Chip";
import { Screen } from "../../components/ui/Screen";
import { useSubscriptionStore } from "../../store/useSubscriptionStore";
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
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
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
          <Text style={type.title}>My Garden</Text>
          <Text style={type.bodySmall}>{subscriptions.length} creatures</Text>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <IconButton
            accessibilityLabel="Filter creatures"
            icon={<SlidersHorizontal size={18} color={colors.text} />}
            onPress={() => showToast({ message: "Use the chips below to filter", tone: "info" })}
          />
          <IconButton
            accessibilityLabel="Search creatures"
            icon={<Search size={18} color={colors.text} />}
            onPress={() => showToast({ message: "Search is coming soon", tone: "info" })}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={{ flexGrow: 0, marginBottom: spacing.md }}
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
    alignItems: "center",
    marginBottom: spacing.md,
  },
  chips: { gap: spacing.sm, paddingRight: spacing.md },
});
