import React, { useEffect, useState } from "react";
import { StyleProp, Text, TextStyle } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { type } from "../../constants/theme";

type Props = { value: number; prefix?: string; suffix?: string; style?: StyleProp<TextStyle> };

// Counts toward the target value whenever it changes.
export function AnimatedNumber({ value, prefix = "$", suffix = "", style }: Props) {
  const progress = useSharedValue(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    progress.value = withTiming(value, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [value, progress]);

  useAnimatedReaction(
    () => progress.value,
    (v) => {
      runOnJS(setDisplay)(Math.round(v * 100) / 100);
    }
  );

  return (
    <Text style={[type.money, style]} accessibilityLabel={`${prefix}${value.toFixed(2)}${suffix}`}>
      {prefix}
      {display.toFixed(2)}
      {suffix}
    </Text>
  );
}
