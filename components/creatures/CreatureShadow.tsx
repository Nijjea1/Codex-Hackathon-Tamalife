import React from "react";
import { StyleSheet, View } from "react-native";

export function CreatureShadow({ width }: { width: number }) {
  return (
    <View
      style={[
        styles.shadow,
        { width, height: width * 0.22, borderRadius: width },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  shadow: {
    backgroundColor: "rgba(0,0,0,0.35)",
    alignSelf: "center",
  },
});
