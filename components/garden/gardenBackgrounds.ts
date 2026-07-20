import type { ImageSourcePropType } from "react-native";

export type GardenBackgroundConfig = {
  id: string;
  colorScheme: "light" | "dark";
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
  minimumXRatio: 0.08,
  maximumXRatio: 0.48,
  minimumYRatio: 0.68,
  maximumYRatio: 0.78,
  actorTopMinimumRatio: 740 / 1264,
};

export const GARDEN_BACKGROUNDS: readonly GardenBackgroundConfig[] = [
  {
    id: "garden-light",
    colorScheme: "light",
    source: require("../../assets/garden-light.png"),
    imageSize: { width: 848, height: 1264 },
    walkableArea: {
      minimumXRatio: 0.18,
      maximumXRatio: 0.82,
      minimumYRatio: 0.35,
      maximumYRatio: 0.52,
    },
  },
  {
    id: "garden-dark",
    colorScheme: "dark",
    source: require("../../assets/garden-dark.png"),
    imageSize: { width: 720, height: 1280 },
    walkableArea: {
      minimumXRatio: 0.18,
      maximumXRatio: 0.82,
      minimumYRatio: 0.36,
      maximumYRatio: 0.52,
    },
  },
  {
    id: "cottage-light",
    colorScheme: "light",
    source: require("../../assets/garden-cottage-light.png"),
    imageSize: COTTAGE_IMAGE_SIZE,
    walkableArea: COTTAGE_WALKABLE_AREA,
  },
  {
    id: "cottage-dark",
    colorScheme: "dark",
    source: require("../../assets/garden-cottage-dark.png"),
    imageSize: COTTAGE_IMAGE_SIZE,
    walkableArea: COTTAGE_WALKABLE_AREA,
  },
];
