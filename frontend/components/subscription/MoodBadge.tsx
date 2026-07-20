import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, radius } from "../../constants/theme";
import { CreatureMood } from "../../types/subscription";
import { moodMeta } from "../../utils/creatureMood";

export function MoodBadge({ mood, small }: { mood: CreatureMood; small?: boolean }) {
  const meta = moodMeta[mood];
  return (
    <View style={[styles.badge, { backgroundColor: meta.softColor }, small && styles.small]}>
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text style={[styles.label, { color: meta.color }, small && { fontSize: 11 }]}>
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  small: { paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 6 },
  label: { fontFamily: fonts.bold, fontSize: 12 },
});
