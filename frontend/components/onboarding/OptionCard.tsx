import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { colors, fonts, radius, spacing } from "../../constants/theme";

type Props = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  selected: boolean;
  onPress: () => void;
};

export function OptionCard({ title, description, icon, selected, onPress }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animated}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={title}
        onPressIn={() => (scale.value = withSpring(0.97, { damping: 16 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 16 }))}
        onPress={() => {
          Haptics.selectionAsync();
          onPress();
        }}
        style={[styles.card, selected && styles.selected]}
      >
        {icon ? <View style={[styles.iconWrap, selected && styles.iconSelected]}>{icon}</View> : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Check size={14} color="#0D0F1C" strokeWidth={3.5} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md + 2,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    minHeight: 72,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  iconSelected: { backgroundColor: "rgba(139,124,255,0.28)" },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  description: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight },
});
