import React, { useCallback, useEffect, useId } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Svg } from "react-native-svg";

const AnimatedG = Animated.createAnimatedComponent(G);

const NATIVE_WIDTH = 270;
const NATIVE_HEIGHT = 230;

// The hand-drawn Penny used on the welcome screen — pops in, dances (spin +
// wave) on arrival and on tap, blinks softly on a loose loop. `size` scales
// the whole thing uniformly so the same character/animation can drop into
// smaller spots (like a companion-reaction row) without redrawing anything.
//
// Scaling is done by resizing the <Svg> itself (its own width/height against
// a fixed viewBox) and multiplying the surrounding layout's pixel values,
// rather than wrapping everything in a transform-scaled ancestor View.
//
// Gradient ids are namespaced per instance (via useId, same pattern as
// components/creatures/bodies.tsx) because react-native-svg resolves
// <RadialGradient id="..."> globally rather than per-<Svg> — with a
// hardcoded id, two PennyPiggy instances mounted at once (e.g. the welcome
// screen still alive in the nav stack behind the reminders screen, which
// also renders one via CompanionReaction) collide and the later instance's
// gradient fails to resolve, rendering as an unfilled outline.
export function PennyPiggy({ isDay, size = NATIVE_WIDTH }: { isDay: boolean; size?: number }) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const bodyGradientId = `pennyBody-${uid}`;
  const earGradientId = `pennyEar-${uid}`;

  const bob = useSharedValue(0);
  const sparkle = useSharedValue(0.35);
  const entrance = useSharedValue(0);
  const fade = useSharedValue(0);
  const armRotation = useSharedValue(0);
  const spin = useSharedValue(0);
  const blink = useSharedValue(0);

  // Spin a full turn while waving the whole way round — used both for the
  // arrival greeting and whenever the user taps Penny to say hi again.
  const danceHello = useCallback(() => {
    "worklet";
    spin.value = 0;
    spin.value = withTiming(360, { duration: 1000, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never });
    armRotation.value = withSequence(
      withTiming(-14, { duration: 110, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
      withTiming(26, { duration: 160, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }),
      withTiming(-10, { duration: 150, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }),
      withTiming(24, { duration: 150, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }),
      withTiming(-10, { duration: 150, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }),
      withTiming(24, { duration: 150, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }),
      withTiming(-10, { duration: 150, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }),
      withTiming(0, { duration: 260, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
    );
  }, [armRotation, spin]);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1450, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        withTiming(0, { duration: 1450, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
    sparkle.value = withRepeat(
      withSequence(withTiming(1, { duration: 850, reduceMotion: ReduceMotion.Never }), withTiming(0.25, { duration: 850, reduceMotion: ReduceMotion.Never })),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );

    // Opacity fades in quickly and monotonically — decoupled from the bouncier
    // scale spring below, so she never reads as stuck partway-transparent
    // while the spring is still settling (or overshooting past 1).
    fade.value = withDelay(120, withTiming(1, { duration: 260, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));

    // Pop in, then spin through a little hello dance, waving the whole way round.
    entrance.value = withDelay(
      120,
      withSpring(1, { damping: 8, stiffness: 110, mass: 0.7, reduceMotion: ReduceMotion.Never }, (finished) => {
        "worklet";
        if (!finished) return;
        danceHello();
      }),
    );

    // Soft, eased blink instead of a hard snap, on a loose loop so it never feels mechanical.
    blink.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 2600, reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: 130, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.Never }),
        withTiming(0, { duration: 170, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
        withDelay(150, withTiming(1, { duration: 120, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.Never })),
        withTiming(0, { duration: 180, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
        withTiming(0, { duration: 1650, reduceMotion: ReduceMotion.Never }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [blink, bob, danceHello, entrance, fade, sparkle]);

  const scale = size / NATIVE_WIDTH;

  const entranceMotion = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: (1 - entrance.value) * 46 * scale }, { scale: 0.55 + entrance.value * 0.45 }],
  }));
  const spinMotion = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const pennyMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: (-3 - bob.value * 8) * scale }, { rotate: `${-1.5 + bob.value * 3}deg` }],
  }));
  const shadowMotion = useAnimatedStyle(() => ({
    opacity: (0.36 - bob.value * 0.13) * fade.value,
    transform: [{ scaleX: (1 - bob.value * 0.12) * (0.5 + fade.value * 0.5) }],
  }));
  const sparkleMotion = useAnimatedStyle(() => ({
    opacity: sparkle.value * fade.value,
    transform: [{ scale: 0.65 + sparkle.value * 0.48 }, { rotate: `${sparkle.value * 20}deg` }],
  }));
  const waveArmProps = useAnimatedProps(() => ({ rotation: armRotation.value }));
  const blinkProps = useAnimatedProps(() => ({ scaleY: 1 - blink.value * 0.92 }));

  const pennyLight = isDay
    ? { bodyLight: "#ffe8bd", bodyDark: "#f3a173", earLight: "#ffd9bd", earDark: "#ef987b", stroke: "#c96e62", shine: "#fff8df" }
    : { bodyLight: "#efd9f4", bodyDark: "#c98ac8", earLight: "#efd3ed", earDark: "#bd78b4", stroke: "#805281", shine: "#fff1ff" };

  return (
    <Pressable
      onPress={danceHello}
      accessibilityRole="button"
      accessibilityLabel="Tap Penny to make her dance"
      hitSlop={12}
      style={({ pressed }) => [
        { width: NATIVE_WIDTH * scale, height: NATIVE_HEIGHT * scale, alignItems: "center", justifyContent: "flex-end" },
        pressed && styles.pennyScenePressed,
      ]}
    >
      <Animated.View style={[styles.pennyShadow, { bottom: 7 * scale, width: 150 * scale, height: 22 * scale }, shadowMotion]} />
      <Animated.Text style={[styles.pennySparkle, { left: 15 * scale, top: 54 * scale, fontSize: 25 * scale }, sparkleMotion]}>{"✦"}</Animated.Text>
      <Animated.Text style={[styles.pennySparkle, { right: 12 * scale, top: 96 * scale, fontSize: 19 * scale }, sparkleMotion]}>{"✦"}</Animated.Text>
      <Animated.View style={entranceMotion}>
        <Animated.View style={spinMotion}>
          <Animated.View style={pennyMotion}>
            <Svg width={256 * scale} height={226 * scale} viewBox="88 112 272 240" accessibilityLabel="Penny the animated piggy bank, waving hello">
              <Defs>
                <RadialGradient id={bodyGradientId} cx="40%" cy="30%" r="75%">
                  <Stop offset="0%" stopColor={pennyLight.bodyLight} />
                  <Stop offset="100%" stopColor={pennyLight.bodyDark} />
                </RadialGradient>
                <RadialGradient id={earGradientId} cx="40%" cy="30%" r="75%">
                  <Stop offset="0%" stopColor={pennyLight.earLight} />
                  <Stop offset="100%" stopColor={pennyLight.earDark} />
                </RadialGradient>
              </Defs>

              <Ellipse cx={170} cy={323} rx={20} ry={16} fill={`url(#${bodyGradientId})`} stroke={pennyLight.stroke} strokeWidth={4} />
              <Ellipse cx={270} cy={323} rx={20} ry={16} fill={`url(#${bodyGradientId})`} stroke={pennyLight.stroke} strokeWidth={4} />
              <Path d="M320 252 Q342 241 337 258 Q349 264 337 274" fill="none" stroke={pennyLight.stroke} strokeWidth={5} strokeLinecap="round" />

              <AnimatedG origin="126,275" animatedProps={waveArmProps}>
                <Ellipse cx={126} cy={275} rx={19} ry={31} rotation={-20} origin="126,275" fill={`url(#${bodyGradientId})`} stroke={pennyLight.stroke} strokeWidth={4} />
                <Ellipse cx={115} cy={253} rx={17} ry={13} rotation={-20} origin="115,253" fill={pennyLight.earLight} stroke={pennyLight.stroke} strokeWidth={4} />
                <Path d="M104 249 l9 5 M112 241 l5 11" stroke={pennyLight.stroke} strokeWidth={3} strokeLinecap="round" />
              </AnimatedG>

              <Ellipse cx={150} cy={154} rx={28} ry={34} fill={`url(#${earGradientId})`} stroke={pennyLight.stroke} strokeWidth={4} />
              <Ellipse cx={290} cy={154} rx={28} ry={34} fill={`url(#${earGradientId})`} stroke={pennyLight.stroke} strokeWidth={4} />
              <Ellipse cx={150} cy={158} rx={14} ry={18} fill="#ffe6d8" />
              <Ellipse cx={290} cy={158} rx={14} ry={18} fill="#ffe6d8" />

              <Ellipse cx={220} cy={235} rx={108} ry={101} fill={`url(#${bodyGradientId})`} stroke={pennyLight.stroke} strokeWidth={4} />
              <Rect x={201} y={143} width={38} height={9} rx={3} fill="#a95857" />
              <Rect x={205} y={146} width={30} height={3} rx={1} fill="#6f4345" opacity={0.55} />
              <Path d="M293 184 l5 11 12 1 -9 8 3 12 -11 -6 -10 6 2 -12 -8 -8 12 -1z" fill="#ffd85f" stroke="#cc8f30" strokeWidth={2} />

              <AnimatedG origin="220,222" animatedProps={blinkProps}>
                <Ellipse cx={180} cy={223} rx={15} ry={19} fill="#2c2416" />
                <Ellipse cx={260} cy={223} rx={15} ry={19} fill="#2c2416" />
                <Circle cx={185} cy={215} r={5.5} fill="#ffffff" />
                <Circle cx={265} cy={215} r={5.5} fill="#ffffff" />
                <Circle cx={176} cy={229} r={2.5} fill="#ffffff" opacity={0.7} />
                <Circle cx={256} cy={229} r={2.5} fill="#ffffff" opacity={0.7} />
              </AnimatedG>

              <Ellipse cx={160} cy={260} rx={18} ry={11} fill="#ef8b81" opacity={0.48} />
              <Ellipse cx={280} cy={260} rx={18} ry={11} fill="#ef8b81" opacity={0.48} />
              <Ellipse cx={220} cy={277} rx={45} ry={35} fill={isDay ? "#ffe1d0" : "#ead4eb"} stroke={pennyLight.stroke} strokeWidth={4} />
              <Ellipse cx={204} cy={273} rx={7} ry={9} fill={pennyLight.stroke} />
              <Ellipse cx={236} cy={273} rx={7} ry={9} fill={pennyLight.stroke} />
              <Path d="M202 294 Q220 307 238 294" fill="none" stroke={pennyLight.stroke} strokeWidth={4} strokeLinecap="round" />
              <G opacity={0.28}>
                <Path d="M143 188 Q163 166 187 174" fill="none" stroke={pennyLight.shine} strokeWidth={8} strokeLinecap="round" />
              </G>
            </Svg>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pennyScenePressed: { opacity: 0.88 },
  pennyShadow: { position: "absolute", borderRadius: 999, backgroundColor: "#140d2d" },
  pennySparkle: { position: "absolute", color: "#ffe66c", zIndex: 3, textShadowColor: "#c07c25", textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 0 },
});
