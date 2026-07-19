import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, radius, spacing } from "../../constants/theme";
import { Subscription } from "../../types/subscription";
import { moodMeta } from "../../utils/creatureMood";
import { Creature } from "../creatures/Creature";

type Props = {
  subscriptions: Subscription[];
  onCreaturePress: (id: string) => void;
};

// The hero garden: an atmospheric platform the user can swipe through.
// Tapping a creature opens its detail screen.
export function GardenHero({ subscriptions, onCreaturePress }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const attention = subscriptions.filter(
    (s) => s.status === "active" && ["concerned", "sick", "critical"].includes(s.mood)
  ).length;

  return (
    <LinearGradient
      colors={["#1A2040", "#151A31", "#12172A"]}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={styles.hero}
    >
      <View style={[styles.ambient, { top: -50, left: -30, backgroundColor: colors.primary }]} />
      <View style={[styles.ambient, { bottom: -70, right: -20, backgroundColor: colors.secondary }]} />

      <View style={styles.overlayRow}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{subscriptions.length} creatures</Text>
        </View>
        {attention > 0 && (
          <View style={[styles.pill, { backgroundColor: colors.warningSoft }]}>
            <Text style={[styles.pillText, { color: colors.warning }]}>
              {attention} need attention
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        snapToInterval={150}
        decelerationRate="fast"
        onScroll={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / 150))}
        scrollEventThrottle={32}
      >
        {subscriptions.map((s, i) => (
          <Pressable
            key={s.id}
            onPress={() => onCreaturePress(s.id)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${s.creatureName}, ${moodMeta[s.mood].label}`}
            style={[styles.slot, i === activeIndex && styles.slotActive]}
          >
            <Creature species={s.species} mood={s.mood} size="medium" />
            <Text style={styles.creatureName}>{s.creatureName}</Text>
            <Text style={[styles.creatureMood, { color: moodMeta[s.mood].color }]}>
              {moodMeta[s.mood].label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.platform} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    paddingVertical: spacing.md,
  },
  ambient: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 180,
    opacity: 0.08,
  },
  overlayRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  pill: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  pillText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textSecondary },
  strip: { paddingHorizontal: spacing.md, gap: spacing.md, alignItems: "flex-end" },
  slot: { width: 134, alignItems: "center", opacity: 0.75, transform: [{ scale: 0.92 }] },
  slotActive: { opacity: 1, transform: [{ scale: 1 }] },
  creatureName: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, marginTop: 6 },
  creatureMood: { fontFamily: fonts.semiBold, fontSize: 11, marginTop: 1 },
  platform: {
    height: 10,
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
});
