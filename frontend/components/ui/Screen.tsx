import React from "react";
import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../../constants/theme";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  edges?: { top?: boolean; bottom?: boolean };
};

export function Screen({ children, scroll = true, style, contentStyle, edges }: Props) {
  const insets = useSafeAreaInsets();
  const padTop = edges?.top === false ? 0 : insets.top + spacing.sm;
  const padBottom = edges?.bottom === false ? 0 : insets.bottom + spacing.lg;

  if (!scroll) {
    return (
      <View style={[styles.root, { paddingTop: padTop, paddingBottom: padBottom }, style, contentStyle]}>
        {children}
      </View>
    );
  }
  return (
    <View style={[styles.root, style]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
