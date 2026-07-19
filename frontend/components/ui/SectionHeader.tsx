import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing, type } from "../../constants/theme";

type Props = { title: string; actionLabel?: string; onAction?: () => void };

export function SectionHeader({ title, actionLabel, onAction }: Props) {
  return (
    <View style={styles.row}>
      <Text style={type.heading}>{title}</Text>
      {actionLabel ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.sm + 4,
  },
  action: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primaryLight },
});
