import { AlertTriangle, Heart, TrendingUp } from "lucide-react-native";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { GardenCard } from "../ui/GardenCard";

type Props = {
  health: number; // 0-100
  thriving: number;
  needsAttention: number;
  priceHikes: number;
};

// One overall "garden health" meter — the HUD that makes the dashboard read
// like a game rather than a notification list.
export function PortfolioHealthBar({ health, thriving, needsAttention, priceHikes }: Props) {
  const p = useGardenPalette();
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(Math.max(0, Math.min(health, 100)) / 100, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [health, fill]);

  const barStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const tone = health >= 80 ? p.success : health >= 50 ? p.warning : p.danger;

  return (
    <GardenCard style={styles.card} compact>
      <View style={styles.headRow}>
        <View style={styles.headLeft}>
          <Heart size={15} color={tone} strokeWidth={2.6} />
          <Text style={[styles.title, { color: p.ink }]}>Garden health</Text>
        </View>
        <Text style={[styles.pct, { color: tone }]}>{health}%</Text>
      </View>

      <View style={[styles.track, { backgroundColor: p.warningBg }]}>
        <Animated.View style={[styles.fill, { backgroundColor: tone }, barStyle]} />
      </View>

      <View style={styles.chips}>
        <View style={styles.chip}>
          <TrendingUp size={12} color={p.success} strokeWidth={2.6} />
          <Text style={[styles.chipText, { color: p.body }]}>{thriving} thriving</Text>
        </View>
        {needsAttention > 0 && (
          <View style={styles.chip}>
            <AlertTriangle size={12} color={p.warning} strokeWidth={2.6} />
            <Text style={[styles.chipText, { color: p.body }]}>{needsAttention} need care</Text>
          </View>
        )}
        {priceHikes > 0 && (
          <View style={styles.chip}>
            <TrendingUp size={12} color={p.danger} strokeWidth={2.6} />
            <Text style={[styles.chipText, { color: p.body }]}>
              {priceHikes} price hike{priceHikes === 1 ? "" : "s"}
            </Text>
          </View>
        )}
      </View>
    </GardenCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.sm, gap: 8 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontFamily: fonts.pixelBold, fontSize: 14 },
  pct: { fontFamily: fonts.pixelBold, fontSize: 16 },
  track: { height: 12, borderRadius: 8, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 4 },
  chipText: { fontFamily: "monospace", fontWeight: "900", fontSize: 10 },
});
