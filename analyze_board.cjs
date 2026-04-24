/**
 * Pixel analysis script to find exact triangle positions on bord.png
 * Scans a horizontal line near the bottom base of the triangles
 * and detects dark↔light color transitions (triangle edges).
 */
const sharp = require('sharp');

async function analyze() {
  const img = sharp('public/afbeeldingen/bord.png');
  const meta = await img.metadata();
  console.log(`Image: ${meta.width}x${meta.height}`);

  // Extract raw pixel data
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  /**
   * Get RGB pixel at (x, y)
   */
  function getPixel(x, y) {
    const idx = (y * width + x) * channels;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
  }

  /**
   * Get brightness at (x, y)
   */
  function brightness(x, y) {
    const p = getPixel(x, y);
    return (p.r + p.g + p.b) / 3;
  }

  // Scan horizontal line near BOTTOM of triangles (y = 85% of height)
  const scanY_bottom = Math.round(height * 0.90);
  // Scan horizontal line near TOP of triangles (y = 10% of height)
  const scanY_top = Math.round(height * 0.10);

  console.log(`\n=== Scanning bottom row at y=${scanY_bottom} ===`);
  scanRow(scanY_bottom);

  console.log(`\n=== Scanning top row at y=${scanY_top} ===`);
  scanRow(scanY_top);

  // Also scan the middle to find bar position
  const scanY_mid = Math.round(height * 0.50);
  console.log(`\n=== Scanning middle at y=${scanY_mid} (find bar) ===`);
  findBar(scanY_mid);

  function scanRow(y) {
    // Find transitions between dark (triangle) and light (background/wood)
    const DARK_THRESHOLD = 120; // Below this = dark triangle
    const LIGHT_THRESHOLD = 160; // Above this = light triangle/wood

    let transitions = [];
    let prevState = 'unknown';

    for (let x = 0; x < width; x += 2) {
      const b = brightness(x, y);
      let state;
      if (b < DARK_THRESHOLD) state = 'dark';
      else if (b > LIGHT_THRESHOLD) state = 'light';
      else state = 'mid';

      if (state !== prevState && state !== 'mid' && prevState !== 'unknown') {
        transitions.push({ x, from: prevState, to: state });
      }
      if (state !== 'mid') prevState = state;
    }

    // Filter: only keep transitions within the playing area (skip frame/tray)
    // Group pairs of transitions to find triangle centers
    console.log(`Found ${transitions.length} transitions`);

    // Print the first 30 transitions
    for (const t of transitions.slice(0, 40)) {
      console.log(`  x=${t.x}: ${t.from} → ${t.to}`);
    }

    // Find triangle centers: between each dark→light and light→dark transition
    // A triangle center is roughly the middle of a dark or light segment
    let segments = [];
    for (let i = 0; i < transitions.length - 1; i++) {
      const start = transitions[i].x;
      const end = transitions[i + 1].x;
      const type = transitions[i].to; // this segment is this color
      const center = Math.round((start + end) / 2);
      const segWidth = end - start;
      if (segWidth > 100 && segWidth < 500) { // filter noise, keep triangle-sized
        segments.push({ center, width: segWidth, type, start, end });
      }
    }

    console.log(`\nTriangle-sized segments:`);
    for (const s of segments) {
      console.log(`  center=${s.center}, width=${s.width}, type=${s.type} (${s.start}-${s.end})`);
    }
  }

  function findBar(y) {
    // The bar/hinge area has wood color surrounded by dark playing surface
    let maxBright = 0;
    let barCenter = 0;

    // Scan middle 40% of image
    const startX = Math.round(width * 0.35);
    const endX = Math.round(width * 0.65);

    let woodRuns = [];
    let runStart = -1;

    for (let x = startX; x < endX; x++) {
      const b = brightness(x, y);
      if (b > 150) {
        if (runStart === -1) runStart = x;
      } else {
        if (runStart !== -1) {
          const runWidth = x - runStart;
          if (runWidth > 20 && runWidth < 300) {
            woodRuns.push({ start: runStart, end: x, center: Math.round((runStart + x) / 2), width: runWidth });
          }
          runStart = -1;
        }
      }
    }

    console.log(`Wood/bar segments at y=${y}:`);
    for (const r of woodRuns) {
      console.log(`  center=${r.center}, width=${r.width} (${r.start}-${r.end})`);
    }
  }
}

analyze().catch(console.error);
