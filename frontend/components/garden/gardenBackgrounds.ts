import type { ImageSourcePropType } from "react-native";
import { GardenMode, pickRandomOption } from "../../constants/gardenMode";

export type GardenBackgroundConfig = {
  id: string;
  mode: GardenMode;
  source: ImageSourcePropType;
  imageSize: {
    width: number;
    height: number;
  };
  walkableArea: {
    minimumXRatio: number;
    maximumXRatio: number;
    minimumYRatio: number;
    maximumYRatio: number;
    actorTopMinimumRatio?: number;
  };
};

const COTTAGE_IMAGE_SIZE = { width: 848, height: 1264 };
const COTTAGE_WALKABLE_AREA = {
  minimumXRatio: 0.06,
  maximumXRatio: 0.56,
  minimumYRatio: 0.61,
  maximumYRatio: 0.78,
  actorTopMinimumRatio: 0.57,
};

type BackgroundPair = readonly [GardenBackgroundConfig, GardenBackgroundConfig];

export const GARDEN_BACKGROUNDS: Record<GardenMode, BackgroundPair> = {
  day: [
    {
      id: "garden-day",
      mode: "day",
      source: require("../../assets/garden-light.png"),
      imageSize: { width: 848, height: 1264 },
      walkableArea: {
        minimumXRatio: 0.1,
        maximumXRatio: 0.9,
        minimumYRatio: 0.31,
        maximumYRatio: 0.62,
      },
    },
    {
      id: "cottage-day",
      mode: "day",
      source: require("../../assets/garden-cottage-light.png"),
      imageSize: COTTAGE_IMAGE_SIZE,
      walkableArea: COTTAGE_WALKABLE_AREA,
    },
  ],
  night: [
    {
      id: "garden-night",
      mode: "night",
      source: require("../../assets/garden-dark.png"),
      imageSize: { width: 720, height: 1280 },
      walkableArea: {
        minimumXRatio: 0.1,
        maximumXRatio: 0.9,
        minimumYRatio: 0.3,
        maximumYRatio: 0.62,
      },
    },
    {
      id: "cottage-night",
      mode: "night",
      source: require("../../assets/garden-cottage-dark.png"),
      imageSize: COTTAGE_IMAGE_SIZE,
      walkableArea: COTTAGE_WALKABLE_AREA,
    },
  ],
};

export function chooseGardenBackground(
  mode: GardenMode,
  random: () => number = Math.random
): GardenBackgroundConfig {
  return pickRandomOption(GARDEN_BACKGROUNDS[mode], random);
}
