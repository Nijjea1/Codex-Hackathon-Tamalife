import { Image, ImageSourcePropType, StyleSheet, View } from "react-native";
import { CreatureMood, CreatureSpecies } from "../../types/subscription";

type MascotSpecies = Extract<
  CreatureSpecies,
  "delivery" | "fitness" | "music" | "news" | "phone" | "video" | "weather"
>;

type Props = { species: MascotSpecies; mood: CreatureMood; size: number };

const frameForMood: Record<CreatureMood, 1 | 2 | 3 | 4> = {
  happy: 1,
  healthy: 1,
  concerned: 2,
  sick: 3,
  critical: 4,
  reviving: 1,
  resolved: 1,
};

const frames: Record<MascotSpecies, Record<1 | 2 | 3 | 4, ImageSourcePropType>> = {
  delivery: {
    1: require("../../assets/subscription-creatures/delivery_box_1.png"),
    2: require("../../assets/subscription-creatures/delivery_box_2.png"),
    3: require("../../assets/subscription-creatures/delivery_box_3.png"),
    4: require("../../assets/subscription-creatures/delivery_box_4.png"),
  },
  fitness: {
    1: require("../../assets/subscription-creatures/gym_bulldog_1.png"),
    2: require("../../assets/subscription-creatures/gym_bulldog_2.png"),
    3: require("../../assets/subscription-creatures/gym_bulldog_3.png"),
    4: require("../../assets/subscription-creatures/gym_bulldog_4.png"),
  },
  music: {
    1: require("../../assets/subscription-creatures/music_blob_1.png"),
    2: require("../../assets/subscription-creatures/music_blob_2.png"),
    3: require("../../assets/subscription-creatures/music_blob_3.png"),
    4: require("../../assets/subscription-creatures/music_blob_4.png"),
  },
  news: {
    1: require("../../assets/subscription-creatures/newspaper_1.png"),
    2: require("../../assets/subscription-creatures/newspaper_2.png"),
    3: require("../../assets/subscription-creatures/newspaper_3.png"),
    4: require("../../assets/subscription-creatures/newspaper_4.png"),
  },
  phone: {
    1: require("../../assets/subscription-creatures/retro_phone_1.png"),
    2: require("../../assets/subscription-creatures/retro_phone_2.png"),
    3: require("../../assets/subscription-creatures/retro_phone_3.png"),
    4: require("../../assets/subscription-creatures/retro_phone_4.png"),
  },
  video: {
    1: require("../../assets/subscription-creatures/robot_player_1.png"),
    2: require("../../assets/subscription-creatures/robot_player_2.png"),
    3: require("../../assets/subscription-creatures/robot_player_3.png"),
    4: require("../../assets/subscription-creatures/robot_player_4.png"),
  },
  weather: {
    1: require("../../assets/subscription-creatures/weather_cloud_1.png"),
    2: require("../../assets/subscription-creatures/weather_cloud_2.png"),
    3: require("../../assets/subscription-creatures/weather_cloud_3.png"),
    4: require("../../assets/subscription-creatures/weather_cloud_4.png"),
  },
};

const mascotSpecies = new Set<MascotSpecies>([
  "delivery", "fitness", "music", "news", "phone", "video", "weather",
]);

export function isSubscriptionMascot(species: CreatureSpecies): species is MascotSpecies {
  return mascotSpecies.has(species as MascotSpecies);
}

export function SubscriptionMascot({ species, mood, size }: Props) {
  const source = frames[species][frameForMood[mood]];
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image source={source} style={styles.image} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
});
