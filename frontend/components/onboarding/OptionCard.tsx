import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { fonts, spacing } from "../../constants/theme";
import { useUIStore } from "../../store/useUIStore";
import { useGardenClickSound } from "./GardenAmbience";

type Props = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  selected: boolean;
  onPress: () => void;
};

export function OptionCard({ title, description, icon, selected, onPress }: Props) {
  const isDay = useUIStore((s) => s.onboardingTheme === "day");
  const playClick = useGardenClickSound();
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
          playClick();
          onPress();
        }}
        style={[styles.card, !isDay && styles.cardNight, selected && styles.selected, selected && !isDay && styles.selectedNight]}
      >
        {icon ? <View style={[styles.iconWrap, !isDay && styles.iconWrapNight, selected && styles.iconSelected]}>{icon}</View> : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, !isDay && styles.titleNight]}>{title}</Text>
          {description ? <Text style={[styles.description, !isDay && styles.descriptionNight]}>{description}</Text> : null}
        </View>
        <View style={[styles.checkbox, !isDay && styles.checkboxNight, selected && styles.checkboxSelected, selected && !isDay && styles.checkboxSelectedNight]}>
          {selected && <Check size={14} color="#fffbe5" strokeWidth={3.5} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, backgroundColor: "rgba(255,250,224,0.94)", borderWidth: 2.5, borderColor: "#789263", borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm + 2, minHeight: 72 },
  cardNight: { backgroundColor: "rgba(43,31,76,0.94)", borderColor: "#7e70aa" },
  selected: { borderColor: "#2f7958", backgroundColor: "#dff0b7", shadowColor: "#426944", shadowOffset: { width: 3, height: 4 }, shadowOpacity: 0.45, shadowRadius: 0 },
  selectedNight: { borderColor: "#c1b2ff", backgroundColor: "#4b3d78", shadowColor: "#151027" },
  iconWrap: { width: 42, height: 42, borderRadius: 7, backgroundColor: "#e7ddb0", alignItems: "center", justifyContent: "center" },
  iconWrapNight: { backgroundColor: "#3a2e61" },
  iconSelected: { backgroundColor: "#aed58d" },
  title: { fontFamily: "monospace", fontWeight: "900", fontSize: 14, color: "#294d38" },
  titleNight: { color: "#fff4d4" },
  description: { fontFamily: fonts.medium, fontSize: 12, color: "#607056", marginTop: 3 },
  descriptionNight: { color: "#c7bddf" },
  checkbox: { width: 24, height: 24, borderRadius: 5, borderWidth: 2, borderColor: "#789263", alignItems: "center", justifyContent: "center" },
  checkboxNight: { borderColor: "#9584cc" },
  checkboxSelected: { backgroundColor: "#3b8c64", borderColor: "#2b6e4d" },
  checkboxSelectedNight: { backgroundColor: "#8f7ae8", borderColor: "#c1b2ff" },
});
