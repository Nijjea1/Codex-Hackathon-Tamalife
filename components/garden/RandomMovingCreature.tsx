import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useUIStore } from "../../store/useUIStore";
import { Subscription } from "../../types/subscription";
import { Creature } from "../creatures/Creature";
import { CreatureHoverCard } from "./CreatureHoverCard";
import { findOpenGardenPoint, GardenPoint } from "./gardenMovement";

type Props = {
  subscription: Subscription;
  initialPosition: GardenPoint;
  gardenWidth: number;
  gardenHeight: number;
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
  targetRegistry: Map<string, GardenPoint>;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
};

type HorizontalPlacement = "left" | "center" | "right";

const CREATURE_SIZE = 72;
const MOVEMENT_SPEED_MULTIPLIER = 1.2;
const TOOLTIP_WIDTH = 190;
const GARDEN_PADDING = 16;

export function RandomMovingCreature({
  subscription,
  initialPosition,
  gardenWidth,
  gardenHeight,
  minimumX,
  maximumX,
  minimumY,
  maximumY,
  targetRegistry,
  selected,
  onSelect,
  onOpen,
}: Props) {
  const reducedMotion = useUIStore((state) => state.reducedMotion);
  const [hovered, setHovered] = useState(false);
  const [horizontalPlacement, setHorizontalPlacement] =
    useState<HorizontalPlacement>("center");
  const [showBelow, setShowBelow] = useState(false);

  const x = useSharedValue(initialPosition.x);
  const y = useSharedValue(initialPosition.y);
  const detailsVisible = hovered || selected;
  const paused = detailsVisible || reducedMotion;

  const updateTooltipPlacement = () => {
    const centerX = x.value + CREATURE_SIZE / 2;

    setHorizontalPlacement(
      centerX < TOOLTIP_WIDTH / 2 + GARDEN_PADDING
        ? "left"
        : centerX > gardenWidth - TOOLTIP_WIDTH / 2 - GARDEN_PADDING
          ? "right"
          : "center"
    );
    setShowBelow(y.value < 110);
  };

  useEffect(() => {
    x.value = initialPosition.x;
    y.value = initialPosition.y;
    targetRegistry.set(subscription.id, initialPosition);
  }, [initialPosition.x, initialPosition.y, subscription.id, targetRegistry, x, y]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const stopMovement = () => {
      cancelAnimation(x);
      cancelAnimation(y);
      targetRegistry.set(subscription.id, { x: x.value, y: y.value });
    };

    if (paused) {
      stopMovement();
      return stopMovement;
    }

    const moveAgain = () => {
      if (stopped) return;

      const occupied = [...targetRegistry.entries()]
        .filter(([id]) => id !== subscription.id)
        .map(([, point]) => point);
      const destination = findOpenGardenPoint({
        width: gardenWidth,
        height: gardenHeight,
        actorSize: CREATURE_SIZE,
        padding: GARDEN_PADDING,
        occupied,
        minimumX,
        maximumX,
        minimumY,
        maximumY,
      });
      const duration = (4200 + Math.random() * 3200) / MOVEMENT_SPEED_MULTIPLIER;

      targetRegistry.set(subscription.id, destination);
      x.value = withTiming(destination.x, {
        duration,
        easing: Easing.inOut(Easing.linear),
      });
      y.value = withTiming(destination.y, {
        duration,
        easing: Easing.inOut(Easing.linear),
      });

      timeout = setTimeout(moveAgain, duration + 500 + Math.random() * 1000);
    };

    moveAgain();

    return () => {
      stopped = true;
      if (timeout) clearTimeout(timeout);
      stopMovement();
    };
  }, [
    gardenHeight,
    gardenWidth,
    maximumX,
    maximumY,
    minimumX,
    minimumY,
    paused,
    subscription.id,
    targetRegistry,
    x,
    y,
  ]);

  useEffect(
    () => () => {
      targetRegistry.delete(subscription.id);
    },
    [subscription.id, targetRegistry]
  );

  const animatedPosition = useAnimatedStyle(
    () => ({
      transform: [{ translateX: x.value }, { translateY: y.value }],
      zIndex: detailsVisible ? 1000 : Math.round(y.value + CREATURE_SIZE),
    }),
    [detailsVisible]
  );

  const handlePress = () => {
    if (Platform.OS === "web" || selected) {
      onOpen();
      return;
    }

    updateTooltipPlacement();
    onSelect();
  };

  const showDetails = () => {
    updateTooltipPlacement();
    setHovered(true);
  };

  return (
    <Animated.View style={[styles.position, animatedPosition]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${subscription.creatureName}, ${subscription.mood}, ${subscription.price} dollars, ${subscription.daysRemaining} days until renewal`}
        accessibilityHint={
          Platform.OS === "web"
            ? "Opens subscription details"
            : selected
              ? "Tap again to open subscription details"
              : "Tap to show subscription details"
        }
        onBlur={() => setHovered(false)}
        onFocus={showDetails}
        onHoverIn={showDetails}
        onHoverOut={() => setHovered(false)}
        onPress={handlePress}
        style={styles.hitTarget}
      >
        <Creature species={subscription.species} mood={subscription.mood} size="small" />
        {detailsVisible ? (
          <View
            pointerEvents="none"
            style={[
              styles.tooltip,
              horizontalPlacement === "left" && styles.tooltipLeft,
              horizontalPlacement === "center" && styles.tooltipCenter,
              horizontalPlacement === "right" && styles.tooltipRight,
              showBelow ? styles.tooltipBelow : styles.tooltipAbove,
            ]}
          >
            <CreatureHoverCard subscription={subscription} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: "absolute",
    left: 0,
    top: 0,
    width: CREATURE_SIZE,
  },
  hitTarget: {
    width: CREATURE_SIZE,
    alignItems: "center",
  },
  tooltip: {
    position: "absolute",
    width: TOOLTIP_WIDTH,
  },
  tooltipLeft: {
    left: 0,
  },
  tooltipCenter: {
    left: CREATURE_SIZE / 2 - TOOLTIP_WIDTH / 2,
  },
  tooltipRight: {
    right: 0,
  },
  tooltipAbove: {
    bottom: CREATURE_SIZE + 12,
  },
  tooltipBelow: {
    top: CREATURE_SIZE + 12,
  },
});
