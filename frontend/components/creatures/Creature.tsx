import * as Haptics from "expo-haptics";
import React, { useEffect, useId } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { CreatureMood, CreatureSpecies } from "../../types/subscription";
import { moodMeta } from "../../utils/creatureMood";
import { useUIStore } from "../../store/useUIStore";
import { bodyBySpecies } from "./bodies";
import { CreatureFace } from "./CreatureFace";
import { CreatureParticles } from "./CreatureParticles";
import { CreatureShadow } from "./CreatureShadow";
import { paletteFor } from "./palettes";
import { isSubscriptionMascot, SubscriptionMascot } from "./SubscriptionMascot";

export type CreatureProps = {
  species: CreatureSpecies;
  mood: CreatureMood;
  size?: "small" | "medium" | "large";
  interactive?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

const SIZES = { small: 72, medium: 120, large: 190 } as const;

// Procedural creature renderer. The body is an SVG (see bodies.tsx) and the
// face is an animated overlay. Swap bodyBySpecies with a Rive/GLB renderer
// later without changing this component's public interface.
export function Creature({
  species,
  mood,
  size = "medium",
  interactive = false,
  onPress,
  accessibilityLabel,
}: CreatureProps) {
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const px = SIZES[size];
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const customMascot = isSubscriptionMascot(species);
  const palette = paletteFor(customMascot ? "blob" : species, mood);
  const Body = bodyBySpecies[customMascot ? "blob" : species];

  const breath = useSharedValue(0);
  const shiver = useSharedValue(0);
  const pop = useSharedValue(1);
  const tiltX = useSharedValue(0);
  const droop = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      breath.value = 0;
      shiver.value = 0;
      droop.value = mood === "sick" || mood === "critical" ? 1 : mood === "concerned" ? 0.5 : 0;
      return;
    }
    const breathDuration =
      mood === "happy" ? 1400 : mood === "sick" ? 3200 : mood === "critical" ? 4200 : mood === "resolved" ? 3000 : 2200;
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: breathDuration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: breathDuration, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
    if (mood === "sick") {
      shiver.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 90 }),
          withTiming(-1, { duration: 90 }),
          withTiming(0, { duration: 90 }),
          withTiming(0, { duration: 2400 })
        ),
        -1
      );
    } else {
      shiver.value = 0;
    }
    droop.value = withTiming(
      mood === "sick" || mood === "critical" ? 1 : mood === "concerned" ? 0.5 : 0,
      { duration: 500 }
    );
  }, [mood, reducedMotion, breath, shiver, droop]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pop.value = withSequence(
      withSpring(1.12, { damping: 6, stiffness: 220 }),
      withSpring(1, { damping: 8 })
    );
    onPress?.();
  };

  const pan = Gesture.Pan()
    .enabled(interactive)
    .onChange((e) => {
      tiltX.value = Math.max(-1, Math.min(1, e.translationX / 90));
    })
    .onEnd(() => {
      tiltX.value = withSpring(0, { damping: 9 });
    });

  const bodyStyle = useAnimatedStyle(() => {
    const breathScale = 1 + breath.value * (mood === "happy" ? 0.05 : 0.03);
    return {
      transform: [
        { translateX: shiver.value * 2.5 },
        { translateY: droop.value * px * 0.04 + breath.value * -px * 0.015 },
        { rotate: `${tiltX.value * 10}deg` },
        { scaleY: breathScale - droop.value * 0.06 },
        { scaleX: 1 + droop.value * 0.03 },
        { scale: pop.value },
      ],
    };
  });

  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 - breath.value * 0.06 }],
    opacity: 0.6 + breath.value * 0.1,
  }));

  const meta = moodMeta[mood];
  const content = (
    <View style={{ width: px, alignItems: "center" }}>
      <Animated.View style={bodyStyle}>
        {customMascot ? (
          <SubscriptionMascot species={species} mood={mood} size={px} />
        ) : (
          <>
            <Body size={px} palette={palette} id={id} />
            <View style={[styles.faceWrap, { top: species === "cloud" ? px * 0.3 : px * 0.34 }]}>
              <CreatureFace
                mood={mood}
                size={px * 0.62}
                cheek={palette.cheek}
                reducedMotion={reducedMotion}
              />
            </View>
          </>
        )}
      </Animated.View>
      <Animated.View style={shadowStyle}>
        <CreatureShadow width={px * 0.62} />
      </Animated.View>
      <CreatureParticles mood={mood} size={px} reducedMotion={reducedMotion} />
    </View>
  );

  const wrapped = (
    <Pressable
      onPress={handlePress}
      disabled={!onPress && !interactive}
      accessibilityRole={onPress ? "button" : "image"}
      accessibilityLabel={accessibilityLabel ?? `Creature, mood ${meta.label}`}
      hitSlop={8}
    >
      {content}
    </Pressable>
  );

  return interactive ? <GestureDetector gesture={pan}>{wrapped}</GestureDetector> : wrapped;
}

const styles = StyleSheet.create({
  faceWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
