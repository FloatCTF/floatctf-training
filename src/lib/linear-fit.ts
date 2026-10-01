export interface Point {
  x: number;
  y: number;
}

export interface LineFit {
  w: number;
  b: number;
}

/** 最小二乘闭式解：w = Sxy / Sxx，b = ȳ - w·x̄ */
export function leastSquares(points: readonly Point[]): LineFit {
  const meanX = points.reduce((s, p) => s + p.x, 0) / points.length;
  const meanY = points.reduce((s, p) => s + p.y, 0) / points.length;
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    sxy += (p.x - meanX) * (p.y - meanY);
    sxx += (p.x - meanX) ** 2;
  }
  const w = sxy / sxx;
  return { w, b: meanY - w * meanX };
}

export function meanSquaredError(points: readonly Point[], w: number, b: number): number {
  const total = points.reduce((s, p) => s + (w * p.x + b - p.y) ** 2, 0);
  return total / points.length;
}

/** 高斯-若尔当消元解 Ax = v（部分主元，对角防零）。 */
export function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const diag = a[col][col] || 1e-12;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col] / diag;
      for (let k = col; k <= n; k += 1) a[row][k] -= factor * a[col][k];
    }
  }
  return a.map((row, i) => row[n] / (row[i] || 1e-12));
}

export interface PolyFitOptions {
  /** x 归一化的中心与尺度：改善高阶条件数。 */
  center: number;
  scale: number;
  /** 加在 AᵀA 对角上的微量岭项，保数值稳定。 */
  ridge?: number;
}

/** 在数据点上拟合 degree 阶多项式，返回系数（次数从低到高）。 */
export function polyfit(
  xs: readonly number[],
  ys: readonly number[],
  degree: number,
  { center, scale, ridge = 0 }: PolyFitOptions,
): number[] {
  const n = degree + 1;
  const ata: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const aty: number[] = Array(n).fill(0);
  for (let s = 0; s < xs.length; s += 1) {
    const t = (xs[s] - center) / scale;
    const basis = [1];
    for (let k = 1; k < n; k += 1) basis.push(basis[k - 1] * t);
    for (let i = 0; i < n; i += 1) {
      aty[i] += basis[i] * ys[s];
      for (let j = 0; j < n; j += 1) ata[i][j] += basis[i] * basis[j];
    }
  }
  if (ridge) for (let i = 0; i < n; i += 1) ata[i][i] += ridge;
  return solveLinearSystem(ata, aty);
}

/** 求值已拟合的多项式（与 polyfit 同一套归一化参数）。 */
export function polyEval(coeffs: readonly number[], x: number, { center, scale }: PolyFitOptions): number {
  const t = (x - center) / scale;
  let result = 0;
  for (let k = coeffs.length - 1; k >= 0; k -= 1) result = result * t + coeffs[k];
  return result;
}
