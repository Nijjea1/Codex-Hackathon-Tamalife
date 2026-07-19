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
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { Subscription } from "../../types/subscription";
import { daysLabel, formatMoney, moodMeta } from "../../utils/creatureMood";
import { Creature } from "../creatures/Creature";
import { MoodBadge } from "./MoodBadge";

type Props = {
  subscription: Subscription;
  onPress: () => void;
  onQuickAction?: (action: "review" | "snooze" | "resolve") => void;
};

const habitatTints: Record<string, [string, string]> = {
  happy: ["#182640", "#14301F"],
  healthy: ["#182640", "#132D2A"],
  concerned: ["#1E2138", "#2E250F"],
  sick: ["#191A28", "#291A20"],
  critical: ["#151420", "#27121A"],
  reviving: ["#1E2145", "#202A4E"],
  resolved: ["#1D2040", "#241F48"],
};

// A habitat tile, not a SaaS rectangle: gradient environment, creature on a
// platform, stats beneath. Long-press wiggles and reveals quick actions.
export function SubscriptionCard({ subscription: s, onPress, onQuickAction }: Props) {
  const [showActions, setShowActions] = useState(false);
  const wiggle = useSharedValue(0);
  const scale = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${wiggle.value}deg` }],
  }));

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  return (
    <Animated.View style={[styles.wrap, animated]}>
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
          colors={habitatTints[s.mood] ?? habitatTints.healthy}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.habitat}
        >
          <Creature species={s.species} mood={s.mood} size="small" />
        </LinearGradient>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.creatureName}>{s.creatureName}</Text>
            <MoodBadge mood={s.mood} small />
          </View>
          <Text style={type.bodySmall} numberOfLines={1}>
            {s.displayName}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.price}>{formatMoney(s.price)}/mo</Text>
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
        </View>
      </Pressable>

      {showActions && onQuickAction ? (
        <View style={styles.quickRow}>
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
              <Text style={styles.quickLabel}>
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  habitat: {
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  info: { padding: spacing.sm + 4 },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  creatureName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  price: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  days: { fontFamily: fonts.semiBold, fontSize: 12 },
  quickRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  quickLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.primaryLight },
});
