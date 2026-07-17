import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../../constants/theme";
import { Creature } from "../creatures/Creature";
import { Button } from "./Button";

type Props = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <Creature species="egg" mood="resolved" size="medium" />
      <Text style={[type.heading, { marginTop: spacing.md, textAlign: "center" }]}>{title}</Text>
      <Text style={[type.body, { textAlign: "center", marginTop: 6 }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
});
