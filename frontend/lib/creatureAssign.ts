// Auto-assigns a creature name + species when a receipt is parsed with high
// confidence, so an uploaded receipt hatches a creature without the user
// choosing anything.

const CREATURE_NAMES = [
  "Nova",
  "Bramble",
  "Echo",
  "Willow",
  "Zephyr",
  "Maple",
  "Pixel",
  "Clover",
  "Biscuit",
  "Tofu",
];



import { CreatureSpecies } from "../types/subscription";

type Assignment = { name: string; species: CreatureSpecies };

const KEYWORD_SPECIES: Array<[RegExp, CreatureSpecies]> = [
  [/doordash|uber\s*eats|instacart|skip the dishes|amazon\s*prime|delivery/i, "delivery"],
  [/planet fitness|goodlife|gym|fitness|workout|peloton|strava/i, "fitness"],
  [/spotify|apple music|soundcloud|tidal|music|audible/i, "music"],
  [/new york times|washington post|wall street journal|economist|medium|substack|news|newspaper/i, "news"],
  [/rogers|bell|telus|verizon|at&t|t-mobile|wireless|mobile|phone/i, "phone"],
  [/netflix|disney\+|hulu|prime video|youtube|crave|streaming|video/i, "video"],
  [/icloud|dropbox|google one|onedrive|weather|forecast|cloud storage/i, "weather"],
];

const SPECIES_BY_CATEGORY: Record<string, CreatureSpecies> = {
  Entertainment: "video",
  Productivity: "phone",
  Fitness: "fitness",
  Storage: "weather",
  Other: "delivery",
};

/** Selects a mascot from the actual subscription, with category as a fallback. */
export function assignCreature(
  category: string,
  vendorName = "",
  displayName = "",
): Assignment {
  const name = CREATURE_NAMES[Math.floor(Math.random() * CREATURE_NAMES.length)];
  const identity = `${vendorName} ${displayName}`;
  const species = KEYWORD_SPECIES.find(([pattern]) => pattern.test(identity))?.[1]
    ?? SPECIES_BY_CATEGORY[category]
    ?? "delivery";

  return { name, species };
}
