export type GardenPoint = {
  x: number;
  y: number;
};

type GardenMovementBoundsOptions = {
  sceneWidth: number;
  sceneHeight: number;
  actorSize: number;
  imageWidth: number;
  imageHeight: number;
  groundLeftRatio: number;
  groundRightRatio: number;
  groundTopRatio: number;
  groundBottomRatio: number;
};

type GardenImageDepthOptions = {
  sceneWidth: number;
  sceneHeight: number;
  imageWidth: number;
  imageHeight: number;
  imageYRatio: number;
};

function getGardenCoverMetrics(
  sceneWidth: number,
  sceneHeight: number,
  imageWidth: number,
  imageHeight: number
) {
  const scale = Math.max(sceneWidth / imageWidth, sceneHeight / imageHeight);

  return {
    scale,
    offsetX: (sceneWidth - imageWidth * scale) / 2,
    offsetY: (sceneHeight - imageHeight * scale) / 2,
  };
}

export function getGardenImageDepth({
  sceneWidth,
  sceneHeight,
  imageWidth,
  imageHeight,
  imageYRatio,
}: GardenImageDepthOptions) {
  const { scale, offsetY } = getGardenCoverMetrics(
    sceneWidth,
    sceneHeight,
    imageWidth,
    imageHeight
  );

  return offsetY + imageHeight * imageYRatio * scale;
}

export function getGardenActorDepth(actorY: number, actorSize: number) {
  "worklet";
  return Math.round(actorY + actorSize);
}

export function getGardenMovementBounds({
  sceneWidth,
  sceneHeight,
  actorSize,
  imageWidth,
  imageHeight,
  groundLeftRatio,
  groundRightRatio,
  groundTopRatio,
  groundBottomRatio,
}: GardenMovementBoundsOptions) {
  const { scale, offsetX, offsetY } = getGardenCoverMetrics(
    sceneWidth,
    sceneHeight,
    imageWidth,
    imageHeight
  );
  const minimumGroundX = offsetX + imageWidth * groundLeftRatio * scale;
  const maximumGroundX = offsetX + imageWidth * groundRightRatio * scale;
  const minimumGroundY = offsetY + imageHeight * groundTopRatio * scale;
  const maximumGroundY = offsetY + imageHeight * groundBottomRatio * scale;
  const maximumActorX = Math.max(0, sceneWidth - actorSize);
  const maximumActorY = Math.max(0, sceneHeight - actorSize);
  const minimumX = Math.min(
    maximumActorX,
    Math.max(0, minimumGroundX - actorSize / 2)
  );
  const maximumX = Math.max(
    minimumX,
    Math.min(maximumActorX, maximumGroundX - actorSize / 2)
  );
  const minimumY = Math.max(0, minimumGroundY - actorSize);
  const maximumY = Math.max(
    minimumY,
    Math.min(maximumActorY, maximumGroundY - actorSize)
  );

  return { minimumX, maximumX, minimumY, maximumY };
}

export function pickRandomGardenIndex(itemCount: number, random = Math.random) {
  return Math.min(itemCount - 1, Math.floor(random() * itemCount));
}

type FindOpenGardenPointOptions = {
  width: number;
  height: number;
  actorSize: number;
  padding: number;
  occupied: GardenPoint[];
  minimumDistance?: number;
  attempts?: number;
  random?: () => number;
  minimumX?: number;
  maximumX?: number;
  minimumY?: number;
  maximumY?: number;
};

export function findOpenGardenPoint({
  width,
  height,
  actorSize,
  padding,
  occupied,
  minimumDistance = actorSize * 1.25,
  attempts = 24,
  random = Math.random,
  minimumX: requestedMinimumX,
  maximumX: requestedMaximumX,
  minimumY: requestedMinimumY,
  maximumY: requestedMaximumY,
}: FindOpenGardenPointOptions): GardenPoint {
  const maximumActorX = Math.max(0, width - actorSize);
  const maximumActorY = Math.max(0, height - actorSize);
  const defaultMaximumX = Math.max(0, width - actorSize - padding);
  const defaultMaximumY = Math.max(0, height - actorSize - padding);
  const defaultMinimumX = defaultMaximumX === 0 ? 0 : padding;
  const defaultMinimumY = defaultMaximumY === 0 ? 0 : padding;
  const minimumX = Math.min(
    maximumActorX,
    Math.max(0, requestedMinimumX ?? defaultMinimumX)
  );
  const maximumX = Math.max(
    minimumX,
    Math.min(maximumActorX, requestedMaximumX ?? defaultMaximumX)
  );
  const minimumY = Math.min(
    maximumActorY,
    Math.max(0, requestedMinimumY ?? defaultMinimumY)
  );
  const maximumY = Math.max(
    minimumY,
    Math.min(maximumActorY, requestedMaximumY ?? defaultMaximumY)
  );

  let bestPoint = { x: minimumX, y: minimumY };
  let bestDistance = -1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const point = {
      x: minimumX + random() * (maximumX - minimumX),
      y: minimumY + random() * (maximumY - minimumY),
    };

    if (occupied.length === 0) return point;

    const nearestDistance = Math.min(
      ...occupied.map((other) => Math.hypot(point.x - other.x, point.y - other.y))
    );

    if (nearestDistance >= minimumDistance) return point;

    if (nearestDistance > bestDistance) {
      bestDistance = nearestDistance;
      bestPoint = point;
    }
  }

  return bestPoint;
}
