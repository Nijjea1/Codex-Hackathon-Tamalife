import {
  findOpenGardenPoint,
  getGardenMovementBounds,
  getGardenTooltipPlacement,
} from "./gardenMovement";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const bounds = getGardenMovementBounds({
  sceneWidth: 400,
  sceneHeight: 600,
  actorSize: 72,
  imageWidth: 848,
  imageHeight: 1264,
  groundLeftRatio: 0.1,
  groundRightRatio: 0.9,
  groundTopRatio: 0.31,
  groundBottomRatio: 0.62,
});

assert(bounds.maximumX - bounds.minimumX > 300, "expected a wide horizontal roaming area");
assert(bounds.maximumY - bounds.minimumY > 175, "expected a tall vertical roaming area");

const cottageBounds = getGardenMovementBounds({
  sceneWidth: 400,
  sceneHeight: 600,
  actorSize: 72,
  imageWidth: 848,
  imageHeight: 1264,
  groundLeftRatio: 0.06,
  groundRightRatio: 0.56,
  groundTopRatio: 0.61,
  groundBottomRatio: 0.78,
  actorTopMinimumRatio: 0.57,
});

assert(cottageBounds.maximumX - cottageBounds.minimumX > 180, "expected a useful cottage lane");
assert(cottageBounds.minimumY >= 340, "expected creatures to stay below the cottage");
assert(
  cottageBounds.maximumY + 72 <= 468,
  "expected creature feet to remain above the cottage pond"
);

const separated = findOpenGardenPoint({
  width: 500,
  height: 400,
  actorSize: 72,
  padding: 16,
  occupied: [{ x: 16, y: 16 }],
  minimumDistance: 112,
  random: (() => {
    const values = [0, 0, 1, 1];
    let index = 0;
    return () => values[index++] ?? 1;
  })(),
});

assert(separated.x === 412 && separated.y === 312, "expected a well-separated fallback point");

const tooltipOptions = {
  actorSize: 72,
  sceneWidth: 400,
  sceneHeight: 600,
  tooltipWidth: 190,
  tooltipHeight: 76,
  padding: 16,
  gap: 12,
};

const topLeft = getGardenTooltipPlacement({
  ...tooltipOptions,
  actor: { x: 10, y: 20 },
});
assert(
  topLeft.horizontal === "left" && topLeft.vertical === "below",
  "expected a top-left tooltip to open inward"
);

const bottomRight = getGardenTooltipPlacement({
  ...tooltipOptions,
  actor: { x: 320, y: 500 },
});
assert(
  bottomRight.horizontal === "right" && bottomRight.vertical === "above",
  "expected a bottom-right tooltip to open inward"
);

const center = getGardenTooltipPlacement({
  ...tooltipOptions,
  actor: { x: 164, y: 280 },
});
assert(
  center.horizontal === "center" && center.vertical === "above",
  "expected a centered tooltip above its creature"
);

console.log("gardenMovement tests passed");
