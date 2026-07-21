export type GardenMode = "day" | "night";

export function resolveGardenMode(preference: unknown): GardenMode {
  return preference === "night" ? "night" : "day";
}

export function pickRandomOption<T>(
  options: readonly [T, ...T[]],
  random: () => number = Math.random
): T {
  const index = Math.min(options.length - 1, Math.floor(random() * options.length));
  return options[Math.max(0, index)];
}
