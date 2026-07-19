import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, type } from "../../constants/theme";
import { Button } from "../ui/Button";
import { CompanionReaction } from "./CompanionReaction";
import { ProgressHeader } from "./ProgressHeader";

type Props = {
  step: number;
  total: number;
  question: string;
  supporting: string;
  children: React.ReactNode;
  canContinue: boolean;
  onContinue: () => void;
  companionMessage?: string;
  continueLabel?: string;
};

export function OnboardingShell({
  step,
  total,
  question,
  supporting,
  children,
  canContinue,
  onContinue,
  companionMessage,
  continueLabel = "Continue",
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md }}>
        <ProgressHeader step={step} total={total} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400).springify()}>
          <Text style={[type.display, { marginTop: spacing.lg }]}>{question}</Text>
          <Text style={[type.body, { marginTop: spacing.sm, marginBottom: spacing.lg }]}>
            {supporting}
          </Text>
        </Animated.View>
        {children}
      </ScrollView>
      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <CompanionReaction hasSelection={canContinue} message={companionMessage} />
        <Button
          label={continueLabel}
          onPress={onContinue}
          disabled={!canContinue}
          style={{ marginTop: spacing.sm + 4 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
