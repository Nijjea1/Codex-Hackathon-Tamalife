import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { Subscription } from "../../types/subscription";
import { daysLabel, formatMoney, moodMeta } from "../../utils/creatureMood";
import { Creature } from "../creatures/Creature";
import { MoodBadge } from "./MoodBadge";
import { PriceHikeNotice } from "./PriceHikeNotice";

type Props = {
  subscription: Subscription;
  onPress: () => void;
  onQuickAction?: (action: "review" | "snooze" | "resolve") => void;
};

// Soft day/night habitat tints — a cozy gradient behind the creature rather
// than a flat rectangle.
const dayTints: Record<string, [string, string]> = {
  happy: ["#e7f4c2", "#cdeaa6"],
  healthy: ["#e3f3c8", "#c7e9c0"],
  concerned: ["#f4ecc2", "#efdca6"],
  sick: ["#f3ddc6", "#eec6c0"],
  critical: ["#f2cfc6", "#e7b0b0"],
  reviving: ["#e4e6f5", "#cdd6ee"],
  resolved: ["#e8e2f4", "#d6cdea"],
};
const nightTints: Record<string, [string, string]> = {
  happy: ["#243a2c", "#1c3320"],
  healthy: ["#22392c", "#1b332a"],
  concerned: ["#33301f", "#2e2810"],
  sick: ["#331f28", "#291a20"],
  critical: ["#301820", "#27121a"],
  reviving: ["#2a2b48", "#232a4e"],
  resolved: ["#2a2448", "#241f48"],
};

// A habitat tile, not a SaaS rectangle: gradient environment, creature on a
// platform, stats beneath. Long-press wiggles and reveals quick actions.
export function SubscriptionCard({ subscription: s, onPress, onQuickAction }: Props) {
  const p = useGardenPalette();
  const [showActions, setShowActions] = useState(false);
  const wiggle = useSharedValue(0);
  const scale = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${wiggle.value}deg` }],
  }));

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    wiggle.value = withSequence(
      withTiming(-2, { duration: 60 }),
      withTiming(2, { duration: 60 }),
      withTiming(-1.4, { duration: 60 }),
      withTiming(1.4, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
    setShowActions((v) => !v);
  };

  const meta = moodMeta[s.mood];
  const tints = p.isDay ? dayTints : nightTints;

  return (
    <Animated.View
      style={[styles.wrap, { backgroundColor: p.cardBg, borderColor: p.cardBorder, shadowColor: p.cardShadow }, animated]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${s.creatureName}, ${s.displayName}, ${meta.label}, ${formatMoney(
          s.price
        )} monthly, next event ${daysLabel(s.daysRemaining)}`}
        onPress={onPress}
        onLongPress={handleLongPress}
        onPressIn={() => (scale.value = withSpring(0.97, { damping: 16 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 16 }))}
      >
        <LinearGradient
          colors={tints[s.mood] ?? tints.healthy}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.habitat, { borderBottomColor: p.cardBorder }]}
        >
          <Creature species={s.species} mood={s.mood} size="small" />
        </LinearGradient>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.creatureName, { color: p.ink }]}>{s.creatureName}</Text>
            <MoodBadge mood={s.mood} small />
          </View>
          <Text style={[styles.display, { color: p.body }]} numberOfLines={1}>
            {s.displayName}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.price, { color: p.inkStrong }]}>{formatMoney(s.price)}/mo</Text>
            <Text style={[styles.days, { color: meta.color }]}>
              {s.status === "cancelled"
                ? "Cancelled"
                : s.status === "renewed"
                ? "Renewed"
                : s.billingInterval === "trial"
                ? `Ends ${daysLabel(s.daysRemaining).toLowerCase()}`
                : daysLabel(s.daysRemaining)}
            </Text>
          </View>
          <PriceHikeNotice subscription={s} compact />
        </View>
      </Pressable>

      {showActions && onQuickAction ? (
        <View style={[styles.quickRow, { borderTopColor: p.cardBorder }]}>
          {(["review", "snooze", "resolve"] as const).map((a) => (
            <Pressable
              key={a}
              accessibilityRole="button"
              onPress={() => {
                setShowActions(false);
                onQuickAction(a);
              }}
              style={styles.quickBtn}
            >
              <Text style={[styles.quickLabel, { color: p.accent }]}>
                {a === "review" ? "Review" : a === "snooze" ? "Snooze" : "Resolve"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 2.5,
    overflow: "hidden",
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 0,
    elevation: 4,
  },
  habitat: {
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
  },
  info: { padding: spacing.sm + 4 },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  creatureName: { fontFamily: fonts.pixelBold, fontSize: 14 },
  display: { fontFamily: fonts.medium, fontSize: 12 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  price: { fontFamily: fonts.pixelBold, fontSize: 13, fontVariant: ["tabular-nums"] },
  days: { fontFamily: "monospace", fontWeight: "900", fontSize: 11 },
  quickRow: { flexDirection: "row", borderTopWidth: 2 },
  quickBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  quickLabel: { fontFamily: "monospace", fontWeight: "900", fontSize: 11 },
});
