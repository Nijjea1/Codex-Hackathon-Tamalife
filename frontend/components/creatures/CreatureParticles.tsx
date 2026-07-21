import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useGardenPalette } from "../../constants/garden";
import { CreatureMood } from "../../types/subscription";

type Props = { mood: CreatureMood; size: number; reducedMotion?: boolean };

function Particle({
  delay,
  x,
  color,
  size,
  reducedMotion,
}: {
  delay: number;
  x: number;
  color: string;
  size: number;
  reducedMotion?: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 0.5;
      return;
    }
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 })
        ),
        -1
      )
    );
  }, [delay, reducedMotion, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.15 ? progress.value * 4 : 1 - progress.value,
    transform: [{ translateY: -progress.value * 46 }, { scale: 0.6 + progress.value * 0.4 }],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { left: x, width: size, height: size, borderRadius: size, backgroundColor: color },
        style,
      ]}
    />
  );
}

export function CreatureParticles({ mood, size, reducedMotion }: Props) {
  const palette = useGardenPalette();
  if (mood === "healthy" || mood === "concerned") return null;
  const sparkle = mood === "happy" || mood === "reviving" || mood === "resolved";
  const color = sparkle
    ? mood === "resolved"
      ? palette.accent
      : palette.goldLight
    : mood === "critical"
      ? palette.danger
      : palette.muted;
  const count = mood === "critical" ? 1 : sparkle ? 3 : 2;

  return (
    <View style={[StyleSheet.absoluteFill]} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <Particle
          key={i}
          delay={i * 800}
          x={size * (0.15 + i * 0.32)}
          color={color}
          size={sparkle ? 6 : 5}
          reducedMotion={reducedMotion}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: { position: "absolute", top: "30%" },
});
