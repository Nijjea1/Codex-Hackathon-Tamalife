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
import { CreatureMood } from "../../types/subscription";

type Props = {
  mood: CreatureMood;
  size: number; // face box width
  cheek: string;
  reducedMotion?: boolean;
};

// Eyes, brows, mouth and cheeks rendered as plain views so they can be
// animated cheaply. Species bodies live in SVG underneath this overlay.
export function CreatureFace({ mood, size, cheek, reducedMotion }: Props) {
  const blink = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = mood === "critical" ? 5200 : mood === "sick" ? 3800 : 2600;
    blink.value = withRepeat(
      withSequence(
        withDelay(interval, withTiming(0.08, { duration: 70 })),
        withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) })
      ),
      -1,
      false
    );
  }, [mood, reducedMotion, blink]);

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: blink.value }],
  }));

  const eye = size * 0.13;
  const droopy = mood === "sick" || mood === "critical";
  const worried = mood === "concerned";
  const happy = mood === "happy" || mood === "reviving";
  const resolved = mood === "resolved";

  const mouthW = size * (happy ? 0.3 : 0.2);
  const mouthH = happy ? size * 0.15 : size * 0.06;

  return (
    <View style={[styles.face, { width: size, height: size * 0.6 }]} pointerEvents="none">
      <View style={[styles.eyeRow, { gap: size * 0.24 }]}>
        <View>
          {worried && <View style={[styles.brow, { width: eye * 1.2, transform: [{ rotate: "14deg" }] }]} />}
          {resolved ? (
            <View style={[styles.closedEye, { width: eye * 1.2, borderRadius: eye }]} />
          ) : (
            <Animated.View
              style={[
                styles.eye,
                { width: eye, height: droopy ? eye * 0.62 : eye, borderRadius: eye },
                eyeStyle,
              ]}
            />
          )}
        </View>
        <View>
          {worried && <View style={[styles.brow, { width: eye * 1.2, transform: [{ rotate: "-14deg" }] }]} />}
          {resolved ? (
            <View style={[styles.closedEye, { width: eye * 1.2, borderRadius: eye }]} />
          ) : (
            <Animated.View
              style={[
                styles.eye,
                { width: eye, height: droopy ? eye * 0.62 : eye, borderRadius: eye },
                eyeStyle,
              ]}
            />
          )}
        </View>
      </View>

      <View style={[styles.cheekRow, { gap: size * 0.44, marginTop: size * 0.02 }]}>
        <View style={[styles.cheek, { width: eye * 0.9, height: eye * 0.5, backgroundColor: cheek }]} />
        <View style={[styles.cheek, { width: eye * 0.9, height: eye * 0.5, backgroundColor: cheek }]} />
      </View>

      <View
        style={[
          styles.mouth,
          {
            width: mouthW,
            height: mouthH,
            borderRadius: mouthW,
            marginTop: size * 0.015,
          },
          happy && { borderBottomLeftRadius: mouthW, borderBottomRightRadius: mouthW, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
          droopy && { transform: [{ rotate: "180deg" }], borderRadius: 4, borderTopLeftRadius: mouthW, borderTopRightRadius: mouthW, opacity: 0.85 },
          resolved && { height: size * 0.045, opacity: 0.7 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  face: { alignItems: "center", justifyContent: "center" },
  eyeRow: { flexDirection: "row", alignItems: "center" },
  eye: { backgroundColor: "#1D2033" },
  closedEye: { height: 3, backgroundColor: "#1D2033", opacity: 0.85 },
  brow: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#1D2033",
    opacity: 0.7,
    marginBottom: 3,
    alignSelf: "center",
  },
  cheekRow: { flexDirection: "row" },
  cheek: { borderRadius: 999, opacity: 0.55 },
  mouth: { backgroundColor: "#1D2033" },
});
