import { Stack } from "expo-router";
import React from "react";
import { useGardenPalette } from "../../constants/garden";

export default function AddLayout() {
  const palette = useGardenPalette();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.bgDeep },
        animation: "slide_from_right",
      }}
    />
  );
}
