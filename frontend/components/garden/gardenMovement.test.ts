import {
  findOpenGardenPoint,
  getGardenMovementBounds,
} from "./gardenMovement";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const centered = findOpenGardenPoint({
  width: 500,
  height: 300,
  actorSize: 72,
  padding: 16,
  occupied: [],
  random: () => 0.5,
});

assert(centered.x === 214, `expected centered x=214, received ${centered.x}`);
assert(centered.y === 114, `expected centered y=114, received ${centered.y}`);

const randomValues = [0, 0, 1, 1];
let randomIndex = 0;
const separated = findOpenGardenPoint({
  width: 500,
  height: 300,
  actorSize: 72,
  padding: 16,
  occupied: [{ x: 16, y: 16 }],
  minimumDistance: 100,
  random: () => randomValues[randomIndex++] ?? 1,
});

assert(separated.x === 412, `expected fallback x=412, received ${separated.x}`);
assert(separated.y === 212, `expected fallback y=212, received ${separated.y}`);

const tiny = findOpenGardenPoint({
  width: 40,
  height: 40,
  actorSize: 72,
  padding: 16,
  occupied: [],
  random: () => 0.8,
});

assert(tiny.x === 0, `expected tiny x=0, received ${tiny.x}`);
assert(tiny.y === 0, `expected tiny y=0, received ${tiny.y}`);

const meadowTop = findOpenGardenPoint({
  width: 600,
  height: 1000,
  actorSize: 72,
  padding: 16,
  occupied: [],
  minimumY: 480,
  maximumY: 580,
  random: () => 0,
});

const meadowBottom = findOpenGardenPoint({
  width: 600,
  height: 1000,
  actorSize: 72,
  padding: 16,
  occupied: [],
  minimumY: 480,
  maximumY: 580,
  random: () => 1,
});

assert(meadowTop.y === 480, `expected meadow top y=480, received ${meadowTop.y}`);
assert(meadowBottom.y === 580, `expected meadow bottom y=580, received ${meadowBottom.y}`);

const horizontallyConstrained = findOpenGardenPoint({
  width: 600,
  height: 1000,
  actorSize: 72,
  padding: 16,
  occupied: [],
  minimumX: 100,
  maximumX: 200,
  random: () => 0.5,
});
assert(
  horizontallyConstrained.x === 150,
  `expected constrained x=150, received ${horizontallyConstrained.x}`
);

const meadowBounds = getGardenMovementBounds({
  sceneWidth: 600,
  sceneHeight: 1000,
  actorSize: 72,
  imageWidth: 600,
  imageHeight: 1000,
  groundLeftRatio: 0.18,
  groundRightRatio: 0.82,
  groundTopRatio: 0.58,
  groundBottomRatio: 0.625,
});
assert(
  meadowBounds.minimumY === 508,
  `expected meadow minimumY=508, received ${meadowBounds.minimumY}`
);
assert(
  meadowBounds.maximumY === 553,
  `expected meadow maximumY=553, received ${meadowBounds.maximumY}`
);

const wideMeadowBounds = getGardenMovementBounds({
  sceneWidth: 600,
  sceneHeight: 1000,
  actorSize: 72,
  imageWidth: 600,
  imageHeight: 1000,
  groundLeftRatio: 0.18,
  groundRightRatio: 0.82,
  groundTopRatio: 0.58,
  groundBottomRatio: 0.7,
});
assert(
  wideMeadowBounds.maximumY === 628,
  `expected wide meadow maximumY=628, received ${wideMeadowBounds.maximumY}`
);

const coverCroppedBounds = getGardenMovementBounds({
  sceneWidth: 719,
  sceneHeight: 983,
  actorSize: 72,
  imageWidth: 720,
  imageHeight: 1280,
  groundLeftRatio: 0.18,
  groundRightRatio: 0.82,
  groundTopRatio: 0.36,
  groundBottomRatio: 0.52,
});
assert(
  Math.abs(coverCroppedBounds.minimumX - 93.42) < 0.01,
  `expected cover-mapped minimumX≈93.42, received ${coverCroppedBounds.minimumX}`
);
assert(
  Math.abs(coverCroppedBounds.maximumX - 553.58) < 0.01,
  `expected cover-mapped maximumX≈553.58, received ${coverCroppedBounds.maximumX}`
);
assert(
  Math.abs(coverCroppedBounds.minimumY - 240.55) < 0.01,
  `expected cover-mapped minimumY≈240.55, received ${coverCroppedBounds.minimumY}`
);
assert(
  Math.abs(coverCroppedBounds.maximumY - 445.06) < 0.01,
  `expected cover-mapped maximumY≈445.06, received ${coverCroppedBounds.maximumY}`
);

const cottageBounds = getGardenMovementBounds({
  sceneWidth: 719,
  sceneHeight: 983,
  actorSize: 72,
  imageWidth: 848,
  imageHeight: 1264,
  groundLeftRatio: 0.08,
  groundRightRatio: 0.48,
  groundTopRatio: 0.68,
  groundBottomRatio: 0.78,
  actorTopMinimumRatio: 740 / 1264,
});
assert(
  Math.abs(cottageBounds.minimumX - 21.52) < 0.01,
  `expected cottage minimumX≈21.52, received ${cottageBounds.minimumX}`
);
assert(
  Math.abs(cottageBounds.maximumX - 309.12) < 0.01,
  `expected cottage maximumX≈309.12, received ${cottageBounds.maximumX}`
);
assert(
  Math.abs(cottageBounds.minimumY - 612.41) < 0.01,
  `expected cottage minimumY≈612.41, received ${cottageBounds.minimumY}`
);
assert(
  Math.abs(cottageBounds.maximumY - 719.58) < 0.01,
  `expected cottage maximumY≈719.58, received ${cottageBounds.maximumY}`
);
assert(
  cottageBounds.maximumX - cottageBounds.minimumX > 280,
  "expected the cottage lane to span the open left and center paths"
);
assert(
  cottageBounds.maximumY - cottageBounds.minimumY > 100,
  "expected meaningful vertical movement in the cottage yard"
);

const smallCottageBounds = getGardenMovementBounds({
  sceneWidth: 320,
  sceneHeight: 500,
  actorSize: 72,
  imageWidth: 848,
  imageHeight: 1264,
  groundLeftRatio: 0.08,
  groundRightRatio: 0.48,
  groundTopRatio: 0.68,
  groundBottomRatio: 0.78,
  actorTopMinimumRatio: 740 / 1264,
});
assert(
  Math.abs(smallCottageBounds.minimumY - 292.72) < 0.01 &&
    Math.abs(smallCottageBounds.maximumY - 318) < 0.01,
  "expected the small portrait cottage lane to stay below the house and above the pond"
);

const smallCottageHouseBottom = (724 / 1264) * 500;
const smallCottagePondTop = (1100 / 1264) * 500;
assert(
  smallCottageBounds.minimumY - smallCottageHouseBottom > 6,
  "expected visible space between a creature and the cottage"
);
assert(
  smallCottagePondTop - (smallCottageBounds.maximumY + 72) > 45,
  "expected visible space between creature feet and the pond"
);

console.log("gardenMovement tests passed");
