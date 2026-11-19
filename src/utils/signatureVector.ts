/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StrokePoint {
  x: number;
  y: number;
}

export const SIGNATURE_VIEWBOX_WIDTH = 420;
export const SIGNATURE_VIEWBOX_HEIGHT = 140;

const round1 = (n: number): number => Math.round(n * 10) / 10;

const clamp = (val: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, val));

/**
 * Downsamples dense pointer trajectories while keeping visual fidelity.
 */
export function simplifyStrokePoints(
  points: StrokePoint[],
  minDistance = 2.4
): StrokePoint[] {
  if (points.length <= 2) return points;
  const result: StrokePoint[] = [points[0]];
  let last = points[0];
  const minDistSq = minDistance * minDistance;

  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    const dx = pt.x - last.x;
    const dy = pt.y - last.y;
    if (dx * dx + dy * dy >= minDistSq) {
      result.push(pt);
      last = pt;
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

const buildSvgPath = (
  strokes: StrokePoint[][],
  minDistance: number,
  useIntegerCoords: boolean
): string => {
  const quantize = useIntegerCoords ? (n: number) => Math.round(n) : round1;
  const pathSegments: string[] = [];

  for (const rawStroke of strokes) {
    if (!rawStroke || rawStroke.length === 0) continue;
    const pts = simplifyStrokePoints(rawStroke, minDistance).map((p) => ({
      x: quantize(clamp(p.x, 0, SIGNATURE_VIEWBOX_WIDTH)),
      y: quantize(clamp(p.y, 0, SIGNATURE_VIEWBOX_HEIGHT)),
    }));

    if (pts.length === 1) {
      const p = pts[0];
      const nextX = round1(clamp(p.x + 0.5, 0, SIGNATURE_VIEWBOX_WIDTH));
      pathSegments.push(`M${p.x} ${p.y}L${nextX} ${p.y}`);
      continue;
    }

    const commands: string[] = [`M${pts[0].x} ${pts[0].y}`];
    for (let i = 1; i < pts.length; i++) {
      commands.push(`L${pts[i].x} ${pts[i].y}`);
    }
    pathSegments.push(commands.join(''));
  }

  return pathSegments.join('');
};

/**
 * Serializes vector strokes into a tiny self-contained SVG DataURL (~0.5–3 KB vs 25–80 KB PNG)
 * to eliminate Firestore 1 MiB document DoS risk while remaining compatible with <img> and PDF export.
 */
export function strokesToSvgDataUrl(
  strokes: StrokePoint[][],
  strokeColor = '#0f172a',
  strokeWidth = 2.3
): string {
  const encodedColor = encodeURIComponent(strokeColor);
  const wrapSvg = (dAttr: string) =>
    `data:image/svg+xml;utf8,` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIGNATURE_VIEWBOX_WIDTH} ${SIGNATURE_VIEWBOX_HEIGHT}">` +
    `<path d="${dAttr}" fill="none" stroke="${encodedColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;

  const initialD = buildSvgPath(strokes, 2.4, false);
  if (!initialD) return '';

  let bestUrl = wrapSvg(initialD);
  if (estimateDataUrlBytes(bestUrl) <= 2900) {
    return bestUrl;
  }

  // Adaptively compact very dense multi-stroke signatures to guarantee < 3 KB payload
  for (const [dist, intCoords] of [
    [3.5, true],
    [5.5, true],
    [8.0, true],
    [12.0, true],
  ] as const) {
    const candidateD = buildSvgPath(strokes, dist, intCoords);
    if (!candidateD) break;
    bestUrl = wrapSvg(candidateD);
    if (estimateDataUrlBytes(bestUrl) <= 2900) {
      return bestUrl;
    }
  }

  return bestUrl;
}

export function estimateDataUrlBytes(dataUrl: string): number {
  if (!dataUrl) return 0;
  return new TextEncoder().encode(dataUrl).length;
}
