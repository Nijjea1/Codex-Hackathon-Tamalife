import { useRouter } from "expo-router";
import { Search, SlidersHorizontal } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../../constants/theme";
import { SubscriptionCard } from "../../components/subscription/SubscriptionCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconButton } from "../../components/ui/IconButton";
import { Chip } from "../../components/ui/Chip";
import { Screen } from "../../components/ui/Screen";
import { useUIStore } from "../../store/useUIStore";
import { CreatureMood } from "../../types/subscription";
import { useSubscriptionData } from "../../lib/useSubscriptionData";

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
  const { subscriptions, loading, error, resolve: resolveSubscription } = useSubscriptionData();
  const showToast = useUIStore((s) => s.showToast);
  const [filter, setFilter] = useState<Filter>("All");

  const filtered =
    filter === "All"
      ? subscriptions
      : subscriptions.filter((s) => filterMoods[filter].includes(s.mood));

  // Two-column layout
  const left = filtered.filter((_, i) => i % 2 === 0);
  const right = filtered.filter((_, i) => i % 2 === 1);

  return (
    <Screen>
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
      {loading && <Text style={type.bodySmall}>Loading subscriptionsâ€¦</Text>}
      {error && <Text style={[type.bodySmall, { color: colors.warning }]}>{error}</Text>}

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
        <View style={styles.columns}>
          <View style={styles.column}>
            {left.map((s) => (
              <SubscriptionCard
                key={s.id}
                subscription={s}
                onPress={() => router.push(`/creature/${s.id}`)}
                onQuickAction={(a) => {
                  if (a === "snooze") {
                    void resolveSubscription(s.id, "snooze").catch((e) =>
                      showToast({ message: (e as Error).message, tone: "warning" })
                    );
                    showToast({ message: `${s.creatureName} snoozed for 3 days`, tone: "info" });
                  } else if (a === "resolve") {
                    void resolveSubscription(s.id, "renew").catch((e) =>
                      showToast({ message: (e as Error).message, tone: "warning" })
                    );
                    showToast({ message: `${s.creatureName} is resolved`, tone: "success" });
                  } else {
                    router.push(`/creature/${s.id}`);
                  }
                }}
              />
            ))}
          </View>
          <View style={styles.column}>
            {right.map((s) => (
              <SubscriptionCard
                key={s.id}
                subscription={s}
                onPress={() => router.push(`/creature/${s.id}`)}
                onQuickAction={(a) => {
                  if (a === "snooze") {
                    void resolveSubscription(s.id, "snooze").catch((e) =>
                      showToast({ message: (e as Error).message, tone: "warning" })
                    );
                    showToast({ message: `${s.creatureName} snoozed for 3 days`, tone: "info" });
                  } else if (a === "resolve") {
                    void resolveSubscription(s.id, "renew").catch((e) =>
                      showToast({ message: (e as Error).message, tone: "warning" })
                    );
                    showToast({ message: `${s.creatureName} is resolved`, tone: "success" });
                  } else {
                    router.push(`/creature/${s.id}`);
                  }
                }}
              />
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  chips: { gap: spacing.sm, paddingRight: spacing.md },
  columns: { flexDirection: "row", gap: spacing.sm + 2 },
  column: { flex: 1, gap: spacing.sm + 2 },
});
