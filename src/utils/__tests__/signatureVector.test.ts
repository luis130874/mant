import { describe, expect, it } from 'vitest';
import {
  estimateDataUrlBytes,
  simplifyStrokePoints,
  strokesToSvgDataUrl,
  type StrokePoint,
} from '../signatureVector';

describe('signatureVector utilities', () => {
  it('simplifies dense pointer trajectories while preserving start and end points', () => {
    const denseStroke: StrokePoint[] = Array.from({ length: 50 }, (_, idx) => ({
      x: 10 + idx * 0.4,
      y: 20 + Math.sin(idx * 0.2) * 0.5,
    }));

    const simplified = simplifyStrokePoints(denseStroke, 2.4);
    expect(simplified.length).toBeLessThan(denseStroke.length);
    expect(simplified[0]).toEqual(denseStroke[0]);
    expect(simplified[simplified.length - 1]).toEqual(denseStroke[denseStroke.length - 1]);

    const shortStroke: StrokePoint[] = [
      { x: 5, y: 5 },
      { x: 6, y: 6 },
    ];
    expect(simplifyStrokePoints(shortStroke)).toEqual(shortStroke);
  });

  it('returns empty string for empty strokes and encodes single-point taps as valid SVG DataURL', () => {
    expect(strokesToSvgDataUrl([])).toBe('');
    expect(strokesToSvgDataUrl([[]])).toBe('');

    const tapUrl = strokesToSvgDataUrl([[{ x: 100, y: 50 }]]);
    expect(tapUrl.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(tapUrl).toContain('<svg');
    expect(tapUrl).toContain('M100 50L100.5 50');
    expect(estimateDataUrlBytes(tapUrl)).toBeLessThan(512);
  });

  it('keeps dense multi-stroke signatures compact under 3 KB to prevent Firestore 1 MiB bloat', () => {
    const strokes: StrokePoint[][] = Array.from({ length: 5 }, (_, sIdx) =>
      Array.from({ length: 120 }, (_, pIdx) => ({
        x: 10 + pIdx * 3.2,
        y: 25 + sIdx * 20 + Math.sin(pIdx * 0.25) * 12,
      }))
    );

    const svgDataUrl = strokesToSvgDataUrl(strokes);
    expect(svgDataUrl.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(svgDataUrl).toContain('<path ');
    expect(estimateDataUrlBytes(svgDataUrl)).toBeLessThan(3072);
  });
});
