/**
 * Arrow shapes painted on a lane (lane-local SVG coordinates: lane 100 wide,
 * road 300 long, driver at the bottom). Used by the 3D lane view.
 */
export const LANE_W = 100;
export const ROAD_H = 300;

const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${LANE_W - Number(x)} ${y}`);

const RIGHT: Record<string, string> = {
  straight: 'M50 285 L50 95',
  'slight right': 'M50 285 L50 195 Q50 150 80 105',
  right: 'M50 285 L50 190 Q50 135 88 135',
  'sharp right': 'M50 285 L50 175 Q50 140 86 168',
  uturn: 'M66 285 L66 150 A 22 22 0 0 0 22 150 L22 222',
};

/** SVG path for a lane arrow (mirrored for left turns; arcs keep their sweep flipped). */
export function laneArrowPath(indication: string): string {
  if (RIGHT[indication]) return RIGHT[indication];
  const right = indication.replace('left', 'right');
  if (right !== indication && RIGHT[right]) return mirror(RIGHT[right]);
  return RIGHT.straight;
}
