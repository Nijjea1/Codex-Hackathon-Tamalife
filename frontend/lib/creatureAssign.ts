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

// Species keyed by the extracted category, falling back to a friendly blob.
const SPECIES_BY_CATEGORY: Record<string, string> = {
  Entertainment: "gem",
  Productivity: "cloud",
  Fitness: "ember",
  Storage: "blob",
  Other: "sprout",
};

export function assignCreature(category: string): { name: string; species: string } {
  const name = CREATURE_NAMES[Math.floor(Math.random() * CREATURE_NAMES.length)];
  const species = SPECIES_BY_CATEGORY[category] ?? "blob";
  return { name, species };
}
