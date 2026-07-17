import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { colors, fonts, spacing } from "../../constants/theme";
import { IconButton } from "../ui/IconButton";

type Props = { step: number; total: number };

export function ProgressHeader({ step, total }: Props) {
  const router = useRouter();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(step / total, { damping: 18 });
  }, [step, total, progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.row}>
      <IconButton
        accessibilityLabel="Go back"
        icon={<ChevronLeft size={22} color={colors.text} />}
        onPress={() => router.back()}
      />
      <View style={styles.track} accessibilityLabel={`Step ${step} of ${total}`}>
        <Animated.View style={[styles.fill, barStyle]} />
      </View>
      <Text style={styles.count}>
        {step} of {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 10, backgroundColor: colors.primary },
  count: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textMuted },
});
