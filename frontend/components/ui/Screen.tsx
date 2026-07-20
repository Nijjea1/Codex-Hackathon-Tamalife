import React from "react";
import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { GardenBackdrop } from "../onboarding/GardenBackdrop";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  edges?: { top?: boolean; bottom?: boolean };
  /** Set false to drop the animated garden backdrop (e.g. modals). */
  backdrop?: boolean;
  strongerShade?: boolean;
};

/**
 * Legacy screen wrapper, now garden-themed: renders the animated day/night
 * garden backdrop behind its content so every screen using it matches the
 * onboarding look. New screens can use GardenScreen for the pixel header too.
 */
export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  edges,
  backdrop = true,
  strongerShade = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const p = useGardenPalette();
  const padTop = edges?.top === false ? 0 : insets.top + spacing.sm;
  const padBottom = edges?.bottom === false ? 0 : insets.bottom + spacing.xl;

  return (
    <View style={[styles.root, { backgroundColor: p.bgDeep }, style]}>
      {backdrop && <GardenBackdrop strongerShade={strongerShade} hideSky />}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            { paddingTop: padTop, paddingBottom: padBottom, paddingHorizontal: spacing.md },
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.flex,
            { paddingTop: padTop, paddingBottom: padBottom },
            contentStyle,
          ]}
        >
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  flex: { flex: 1 },
});
