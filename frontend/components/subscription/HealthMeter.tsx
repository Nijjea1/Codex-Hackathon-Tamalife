import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { CreatureMood } from "../../types/subscription";
import { moodMeta } from "../../utils/creatureMood";

type Props = { mood: CreatureMood };

// Five-segment meter with a text label so health is never colour-only.
export function HealthMeter({ mood }: Props) {
  const p = useGardenPalette();
  const meta = moodMeta[mood];
  return (
    <View accessibilityLabel={`Health: ${meta.label}, ${meta.segments} of 5`}>
      <View style={styles.row}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i < meta.segments ? meta.color : p.warningBg },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: p.body }]}>
        {meta.label} · {meta.segments}/5
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 5 },
  segment: { flex: 1, height: 8, borderRadius: 6 },
  label: {
    fontFamily: "monospace",
    fontWeight: "900",
    fontSize: 11,
    marginTop: spacing.xs + 2,
  },
});
