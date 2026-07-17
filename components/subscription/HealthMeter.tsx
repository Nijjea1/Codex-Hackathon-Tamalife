import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing } from "../../constants/theme";
import { CreatureMood } from "../../types/subscription";
import { moodMeta } from "../../utils/creatureMood";

type Props = { mood: CreatureMood };

// Five-segment meter with a text label so health is never colour-only.
export function HealthMeter({ mood }: Props) {
  const meta = moodMeta[mood];
  return (
    <View accessibilityLabel={`Health: ${meta.label}, ${meta.segments} of 5`}>
      <View style={styles.row}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i < meta.segments ? meta.color : colors.surfaceRaised },
            ]}
          />
        ))}
      </View>
      <Text style={styles.label}>
        {meta.label} · {meta.segments}/5
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 5 },
  segment: { flex: 1, height: 8, borderRadius: 6 },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs + 2,
  },
});
