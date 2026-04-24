export interface PointLayout {
  /** Point number 1-24 */
  id: number;
  /** X center as percentage of board width (0-100) */
  x: number;
  /** Y base (tip of triangle) as percentage of board height (0-100) */
  yBase: number;
  /** Whether pieces stack downward (top triangles) or upward (bottom triangles) */
  isTop: boolean;
}

export interface ZoneLayout {
  /** X center as percentage */
  x: number;
  /** Y center as percentage */
  y: number;
  /** Width as percentage */
  w: number;
  /** Height as percentage */
  h: number;
}

export interface BoardLayout {
  /** All 24 point positions */
  points: PointLayout[];
  /** Bar zone (center hinge) */
  bar: ZoneLayout;
  /** Left tray (dice cups / bear-off for one side) */
  trayLeft: ZoneLayout;
  /** Right tray (green felt / bear-off for other side) */
  trayRight: ZoneLayout;
  /** Image native aspect ratio (width / height) */
  aspectRatio: number;
}
