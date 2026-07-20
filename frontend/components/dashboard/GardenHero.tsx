import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
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
  const p = useGardenPalette();
  const [activeIndex, setActiveIndex] = useState(0);
  const attention = subscriptions.filter(
    (s) => s.status === "active" && ["concerned", "sick", "critical"].includes(s.mood)
  ).length;

  return (
    <View style={[styles.hero, { backgroundColor: p.cardBg, borderColor: p.cardBorder, shadowColor: p.cardShadow }]}>
      <View style={styles.overlayRow}>
        <View style={[styles.pill, { backgroundColor: p.pill, borderColor: p.pillBorder }]}>
          <Text style={[styles.pillText, { color: p.pillInk }]}>{subscriptions.length} CREATURES</Text>
        </View>
        {attention > 0 && (
          <View style={[styles.pill, { backgroundColor: p.warningBg, borderColor: p.warning }]}>
            <Text style={[styles.pillText, { color: p.warning }]}>{attention} NEED ATTENTION</Text>
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
            <Text style={[styles.creatureName, { color: p.ink }]}>{s.creatureName}</Text>
            <Text style={[styles.creatureMood, { color: moodMeta[s.mood].color }]}>
              {moodMeta[s.mood].label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.platform, { backgroundColor: p.pillBorder }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 16,
    borderWidth: 2.5,
    overflow: "hidden",
    paddingVertical: spacing.md,
    shadowOffset: { width: 4, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 5,
  },
  overlayRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    flexWrap: "wrap",
  },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  pillText: { fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.5 },
  strip: { paddingHorizontal: spacing.md, gap: spacing.md, alignItems: "flex-end" },
  slot: { width: 134, alignItems: "center", opacity: 0.72, transform: [{ scale: 0.92 }] },
  slotActive: { opacity: 1, transform: [{ scale: 1 }] },
  creatureName: { fontFamily: fonts.pixelBold, fontSize: 14, marginTop: 6 },
  creatureMood: { fontFamily: "monospace", fontWeight: "900", fontSize: 10, marginTop: 2 },
  platform: {
    height: 8,
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    borderRadius: 10,
    opacity: 0.5,
  },
});
