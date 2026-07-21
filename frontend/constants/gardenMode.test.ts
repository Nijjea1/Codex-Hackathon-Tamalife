import { pickRandomOption, resolveGardenMode } from "./gardenMode";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(resolveGardenMode("night") === "night", "expected an explicit night preference");
assert(resolveGardenMode("day") === "day", "expected an explicit day preference");
assert(resolveGardenMode(undefined) === "day", "expected a missing preference to default to day");
assert(resolveGardenMode("system") === "day", "expected an invalid preference to default to day");

const choices = ["first", "second"] as const;
assert(pickRandomOption(choices, () => 0) === "first", "expected the first option");
assert(pickRandomOption(choices, () => 0.99) === "second", "expected the second option");

console.log("gardenMode tests passed");
