import type { ImageSourcePropType } from "react-native";

export type GardenBackgroundConfig = {
  id: string;
  colorScheme: "light" | "dark";
  source: ImageSourcePropType;
  foreground?: {
    source: ImageSourcePropType;
    depthRatio: number;
  };
  imageSize: {
    width: number;
    height: number;
  };
  walkableArea: {
    minimumXRatio: number;
    maximumXRatio: number;
    minimumYRatio: number;
    maximumYRatio: number;
  };
};

const COTTAGE_IMAGE_SIZE = { width: 848, height: 1264 };
const COTTAGE_WALKABLE_AREA = {
  minimumXRatio: 0.22,
  maximumXRatio: 0.5,
  minimumYRatio: 0.55,
  maximumYRatio: 0.74,
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
    foreground: {
      source: require("../../assets/garden-cottage-light-foreground.png"),
      depthRatio: 0.57,
    },
    imageSize: COTTAGE_IMAGE_SIZE,
    walkableArea: COTTAGE_WALKABLE_AREA,
  },
  {
    id: "cottage-dark",
    colorScheme: "dark",
    source: require("../../assets/garden-cottage-dark.png"),
    foreground: {
      source: require("../../assets/garden-cottage-dark-foreground.png"),
      depthRatio: 0.57,
    },
    imageSize: COTTAGE_IMAGE_SIZE,
    walkableArea: COTTAGE_WALKABLE_AREA,
  },
];
