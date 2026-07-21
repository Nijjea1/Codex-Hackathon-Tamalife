import React, { useEffect, useMemo, useState } from "react";
import { Image, LayoutChangeEvent, StyleSheet, View } from "react-native";
import { useGardenMode, useGardenPalette } from "../../constants/garden";
import { radius } from "../../constants/theme";
import { Subscription } from "../../types/subscription";
import { chooseGardenBackground } from "./gardenBackgrounds";
import {
  findOpenGardenPoint,
  GardenPoint,
  getGardenMovementBounds,
} from "./gardenMovement";
import { RandomMovingCreature } from "./RandomMovingCreature";

type Props = {
  subscriptions: Subscription[];
  onCreatureOpen: (id: string) => void;
};

type GardenSize = {
  width: number;
  height: number;
};

const CREATURE_SIZE = 72;
const GARDEN_PADDING = 16;
const MINIMUM_CREATURE_DISTANCE = 112;

export function GardenScene({ subscriptions, onCreatureOpen }: Props) {
  const palette = useGardenPalette();
  const mode = useGardenMode();
  const [gardenSize, setGardenSize] = useState<GardenSize>({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const gardenBackground = useMemo(() => chooseGardenBackground(mode), [mode]);
  const {
    minimumX: minimumCreatureX,
    maximumX: maximumCreatureX,
    minimumY: minimumCreatureY,
    maximumY: maximumCreatureY,
  } = getGardenMovementBounds({
    sceneWidth: gardenSize.width,
    sceneHeight: gardenSize.height,
    actorSize: CREATURE_SIZE,
    imageWidth: gardenBackground.imageSize.width,
    imageHeight: gardenBackground.imageSize.height,
    groundLeftRatio: gardenBackground.walkableArea.minimumXRatio,
    groundRightRatio: gardenBackground.walkableArea.maximumXRatio,
    groundTopRatio: gardenBackground.walkableArea.minimumYRatio,
    groundBottomRatio: gardenBackground.walkableArea.maximumYRatio,
    actorTopMinimumRatio: gardenBackground.walkableArea.actorTopMinimumRatio,
  });

  const spawnPositions = useMemo(() => {
    const positions = new Map<string, GardenPoint>();
    const occupied: GardenPoint[] = [];

    if (gardenSize.width === 0 || gardenSize.height === 0) return positions;

    subscriptions.forEach((subscription) => {
      const point = findOpenGardenPoint({
        width: gardenSize.width,
        height: gardenSize.height,
        actorSize: CREATURE_SIZE,
        padding: GARDEN_PADDING,
        occupied,
        minimumDistance: MINIMUM_CREATURE_DISTANCE,
        minimumX: minimumCreatureX,
        maximumX: maximumCreatureX,
        minimumY: minimumCreatureY,
        maximumY: maximumCreatureY,
      });

      positions.set(subscription.id, point);
      occupied.push(point);
    });

    return positions;
  }, [
    gardenSize.height,
    gardenSize.width,
    maximumCreatureX,
    maximumCreatureY,
    minimumCreatureX,
    minimumCreatureY,
    subscriptions,
  ]);

  const targetRegistry = useMemo(() => new Map(spawnPositions), [spawnPositions]);

  useEffect(() => {
    if (selectedId && !subscriptions.some((subscription) => subscription.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, subscriptions]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    setGardenSize((current) =>
      current.width === width && current.height === height ? current : { width, height }
    );
  };

  return (
    <View
      accessibilityLabel="Subscription creature garden"
      onLayout={handleLayout}
      style={[
        styles.scene,
        { backgroundColor: palette.bgDeep, borderColor: palette.cardBorder },
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image
          accessible={false}
          source={gardenBackground.source}
          resizeMode="cover"
          style={styles.backgroundImage}
        />
      </View>

      {subscriptions.map((subscription) => {
        const initialPosition = spawnPositions.get(subscription.id);
        if (!initialPosition) return null;

        return (
          <RandomMovingCreature
            key={subscription.id}
            subscription={subscription}
            initialPosition={initialPosition}
            gardenWidth={gardenSize.width}
            gardenHeight={gardenSize.height}
            minimumX={minimumCreatureX}
            maximumX={maximumCreatureX}
            minimumY={minimumCreatureY}
            maximumY={maximumCreatureY}
            minimumDistance={MINIMUM_CREATURE_DISTANCE}
            targetRegistry={targetRegistry}
            selected={selectedId === subscription.id}
            onSelect={() => setSelectedId(subscription.id)}
            onOpen={() => onCreatureOpen(subscription.id)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    width: "100%",
    height: "100%",
  },
  scene: {
    position: "relative",
    flex: 1,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: radius.xl,
  },
});
