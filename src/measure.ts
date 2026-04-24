/**
 * Quick pixel measurement helper.
 * Run with: npx ts-node src/measure.ts
 *
 * We need to identify triangle centers from the image.
 * Image: 5504 × 3072
 *
 * Careful visual analysis of bord.png:
 *
 * LEFT HALF (tray | inner frame | 6 triangles | bar):
 *   - Outer frame left edge: x ≈ 60
 *   - Tray right edge:       x ≈ 525
 *   - Inner frame left edge: x ≈ 590
 *   - Playing field starts:  x ≈ 680 (first dark triangle left edge)
 *   - 6 triangles span:      x ≈ 680 to x ≈ 2620
 *   - Bar center:            x ≈ 2720
 *
 * Triangle width = (2620 - 680) / 6 ≈ 323px
 * Centers: 680+162=842, 842+323=1165, 1488, 1811, 2134, 2457
 *
 * RIGHT HALF (bar | 6 triangles | green tray):
 *   - Playing field starts:  x ≈ 2830
 *   - Playing field ends:    x ≈ 4770
 *   - Green tray starts:     x ≈ 4830
 *
 * Triangle width = (4770 - 2830) / 6 ≈ 323px
 * Centers: 2830+162=2992, 3315, 3638, 3961, 4284, 4607
 *
 * VERTICAL:
 *   - Top frame inner:       y ≈ 115
 *   - Top triangle base:     y ≈ 170  (where the triangles actually start)
 *   - Top triangle tip:      y ≈ 1410
 *   - Bottom triangle tip:   y ≈ 1660
 *   - Bottom triangle base:  y ≈ 2900
 *   - Bottom frame inner:    y ≈ 2960
 */

// LEFT FIELD centers
const LF_NEW = [842, 1165, 1488, 1811, 2134, 2457];
// RIGHT FIELD centers
const RF_NEW = [2992, 3315, 3638, 3961, 4284, 4607];

console.log('Left field centers:', LF_NEW);
console.log('Right field centers:', RF_NEW);
console.log('Triangle width:', LF_NEW[1] - LF_NEW[0]);
console.log('Gap between fields:', RF_NEW[0] - LF_NEW[5]); // should be ~bar width
console.log('Bar center estimate:', (LF_NEW[5] + RF_NEW[0]) / 2);
