import type { Point2D } from './types';

export function solveHomographyMatrix(
  srcPts: [Point2D, Point2D, Point2D, Point2D],
  dstPts: [Point2D, Point2D, Point2D, Point2D]
): number[][] {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = srcPts[i];
    const { x: dx, y: dy } = dstPts[i];

    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dy]);
    b.push(dx);

    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }

  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }

    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];

    const pivot = A[i][i];
    if (Math.abs(pivot) < 1e-10) continue;

    for (let j = i; j < n; j++) {
      A[j][i] = A[i][j] / pivot; // Keep standard
      A[i][j] /= pivot;
    }
    b[i] /= pivot;

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = A[k][i];
        for (let j = i; j < n; j++) {
          A[k][j] -= factor * A[i][j];
        }
        b[k] -= factor * b[i];
      }
    }
  }

  return [
    [b[0], b[1], b[2]],
    [b[3], b[4], b[5]],
    [b[6], b[7], 1.0]
  ];
}

export function projectPointBEV(H: number[][], pt: Point2D): Point2D {
  const x = pt.x;
  const y = pt.y;

  const w = H[2][0] * x + H[2][1] * y + H[2][2];
  if (Math.abs(w) < 1e-7) {
    return { x: 0, y: 0 };
  }

  const px = (H[0][0] * x + H[0][1] * y + H[0][2]) / w;
  const py = (H[1][0] * x + H[1][1] * y + H[1][2]) / w;

  return { x: px, y: py };
}

export function calculateMetricDistanceMeters(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function calculateResidualErrorCm(
  H: number[][],
  srcPts: [Point2D, Point2D, Point2D, Point2D],
  dstPts: [Point2D, Point2D, Point2D, Point2D]
): number {
  let totalError = 0;
  for (let i = 0; i < 4; i++) {
    const projected = projectPointBEV(H, srcPts[i]);
    const errorM = calculateMetricDistanceMeters(projected, dstPts[i]);
    totalError += errorM;
  }
  const avgErrorM = totalError / 4;
  return Math.round(avgErrorM * 100 * 10) / 10;
}
