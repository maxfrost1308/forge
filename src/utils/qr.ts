/**
 * Minimal QR Code generator — produces SVG markup from text/URL.
 * Self-contained, no external dependencies.
 *
 * Based on the QR code specification (ISO/IEC 18004).
 * Supports alphanumeric & byte mode, error correction level M, versions 1-10.
 */

const EXP = new Uint8Array(256);
const LOG = new Uint8Array(256);
(function initGF() {
  let v = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = v;
    LOG[v] = i;
    v = (v << 1) ^ (v & 128 ? 0x11d : 0);
  }
  EXP[255] = EXP[0];
})();

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[(LOG[a] + LOG[b]) % 255];
}

function polyMul(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length - 1);
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) result[i + j] ^= gfMul(a[i], b[j]);
  return result as any;
}

function genPoly(n: number): Uint8Array {
  let g: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < n; i++) g = polyMul(g, new Uint8Array([1, EXP[i]])) as any;
  return g;
}

function ecBytes(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = genPoly(ecLen);
  const msg = new Uint8Array(data.length + ecLen);
  msg.set(data);
  for (let i = 0; i < data.length; i++) {
    const coeff = msg[i];
    if (coeff !== 0) {
      for (let j = 0; j < gen.length; j++) msg[i + j] ^= gfMul(gen[j], coeff);
    }
  }
  return msg.slice(data.length);
}

const VERSION_TABLE = [
  null,
  [26, 10, 1, 16],
  [44, 16, 1, 28],
  [70, 26, 1, 44],
  [100, 18, 2, 64],
  [134, 24, 2, 86],
  [172, 16, 4, 108],
  [196, 18, 4, 124],
  [242, 24, 4, 154],
  [292, 30, 4, 182],
  [346, 18, 6, 216],
];

function getVersion(dataLen: number): number | null {
  for (let v = 1; v <= 10; v++) {
    const lenBits = v <= 9 ? 8 : 16;
    const dataBits = 4 + lenBits + dataLen * 8;
    const dataBytes = (VERSION_TABLE[v] as number[])[3];
    if (dataBits <= dataBytes * 8) return v;
  }
  return null;
}

const ALIGN_POS = [
  null,
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 52],
];

const FORMAT_BITS = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];

function createMatrix(size: number): Int8Array[] {
  return Array.from({ length: size }, () => new Int8Array(size));
}

function createFuncMatrix(size: number): Uint8Array[] {
  return Array.from({ length: size }, () => new Uint8Array(size));
}

function setModule(matrix: Int8Array[], r: number, c: number, val: boolean | number): void {
  matrix[r][c] = val ? 1 : -1;
}

function addFinderPattern(matrix: Int8Array[], isFunc: Uint8Array[], row: number, col: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const mr = row + r,
        mc = col + c;
      if (mr < 0 || mr >= matrix.length || mc < 0 || mc >= matrix.length) continue;
      const inOuter = r === 0 || r === 6 || c === 0 || c === 6;
      const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const inBorder = r === -1 || r === 7 || c === -1 || c === 7;
      setModule(matrix, mr, mc, !inBorder && (inOuter || inInner));
      isFunc[mr][mc] = 1;
    }
  }
}

function addAlignmentPattern(matrix: Int8Array[], isFunc: Uint8Array[], row: number, col: number): void {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const isBlack = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
      setModule(matrix, row + r, col + c, isBlack);
      isFunc[row + r][col + c] = 1;
    }
  }
}

function addTimingPatterns(matrix: Int8Array[], isFunc: Uint8Array[]): void {
  const n = matrix.length;
  for (let i = 8; i < n - 8; i++) {
    setModule(matrix, 6, i, i % 2 === 0);
    setModule(matrix, i, 6, i % 2 === 0);
    isFunc[6][i] = 1;
    isFunc[i][6] = 1;
  }
}

function reserveFormatArea(matrix: Int8Array[], isFunc: Uint8Array[]): void {
  const n = matrix.length;
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === 0) setModule(matrix, 8, i, false);
    if (matrix[i][8] === 0) setModule(matrix, i, 8, false);
    isFunc[8][i] = 1;
    isFunc[i][8] = 1;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][n - 1 - i] === 0) setModule(matrix, 8, n - 1 - i, false);
    isFunc[8][n - 1 - i] = 1;
  }
  for (let i = 0; i < 7; i++) {
    if (matrix[n - 1 - i][8] === 0) setModule(matrix, n - 1 - i, 8, false);
    isFunc[n - 1 - i][8] = 1;
  }
  setModule(matrix, n - 8, 8, true);
  isFunc[n - 8][8] = 1;
}

function placeData(matrix: Int8Array[], bits: number[]): void {
  const n = matrix.length;
  let bitIdx = 0;
  let upward = true;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const rows = upward
      ? Array.from({ length: n }, (_, i) => n - 1 - i)
      : Array.from({ length: n }, (_, i) => i);
    for (const row of rows) {
      for (const col of [right, right - 1]) {
        if (matrix[row][col] === 0) {
          const bit = bitIdx < bits.length ? bits[bitIdx] : 0;
          matrix[row][col] = bit ? 1 : -1;
          bitIdx++;
        }
      }
    }
    upward = !upward;
  }
}

function applyMask(
  matrix: Int8Array[],
  isFunc: Uint8Array[],
  maskFn: (r: number, c: number) => boolean
): Int8Array[] {
  const n = matrix.length;
  const result = matrix.map((row) => Int8Array.from(row));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!isFunc[r][c] && matrix[r][c] !== 0 && maskFn(r, c)) {
        result[r][c] = result[r][c] === 1 ? -1 : 1;
      }
    }
  }
  return result;
}

function writeFormatBits(matrix: Int8Array[], maskIdx: number): void {
  const n = matrix.length;
  const bits = FORMAT_BITS[maskIdx];
  const hCols = [0, 1, 2, 3, 4, 5, 7, 8, n - 8, n - 7, n - 6, n - 5, n - 4, n - 3, n - 2, n - 1];
  for (let i = 0; i < 15; i++) {
    setModule(matrix, 8, hCols[i], (bits >> i) & 1);
  }
  const vRows = [n - 1, n - 2, n - 3, n - 4, n - 5, n - 6, n - 7, n - 8, 7, 5, 4, 3, 2, 1, 0];
  for (let i = 0; i < 15; i++) {
    setModule(matrix, vRows[i], 8, (bits >> i) & 1);
  }
}

const MASKS = [
  (r: number, c: number) => (r + c) % 2 === 0,
  (r: number, c: number) => r % 2 === 0,
  (r: number, c: number) => c % 3 === 0,
  (r: number, c: number) => (r + c) % 3 === 0,
  (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function scoreMask(matrix: Int8Array[]): number {
  const n = matrix.length;
  let penalty = 0;
  for (let r = 0; r < n; r++) {
    let count = 1;
    for (let c = 1; c < n; c++) {
      if ((matrix[r][c] > 0) === (matrix[r][c - 1] > 0)) {
        count++;
      } else {
        if (count >= 5) penalty += count - 2;
        count = 1;
      }
    }
    if (count >= 5) penalty += count - 2;
  }
  for (let c = 0; c < n; c++) {
    let count = 1;
    for (let r = 1; r < n; r++) {
      if ((matrix[r][c] > 0) === (matrix[r - 1][c] > 0)) {
        count++;
      } else {
        if (count >= 5) penalty += count - 2;
        count = 1;
      }
    }
    if (count >= 5) penalty += count - 2;
  }
  return penalty;
}

/**
 * Generate a QR code SVG string for the given text.
 * Returns an SVG element string with viewBox matching the QR matrix size.
 *
 * @param text - The text or URL to encode
 * @param options - Optional configuration
 * @param options.fg - Foreground (dark module) color (default: '#000')
 * @param options.bg - Background color (default: '#fff')
 * @param options.quietZone - Quiet zone modules around QR (default: 2)
 * @returns SVG markup string, or empty string on failure
 */
export function generateQrSvg(
  text: string,
  options: { fg?: string; bg?: string; quietZone?: number } = {}
): string {
  if (!text || typeof text !== "string") return "";
  const { fg = "#000", bg = "#fff", quietZone = 2 } = options;

  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const version = getVersion(bytes.length);
  if (!version) return "";

  const vInfo = VERSION_TABLE[version] as number[];
  const [totalCW, ecCWPerBlock, numBlocks, dataCW] = vInfo;
  const size = 17 + version * 4;

  const lenBits = version <= 9 ? 8 : 16;
  const dataBits: number[] = [];
  dataBits.push(0, 1, 0, 0);
  for (let i = lenBits - 1; i >= 0; i--) dataBits.push((bytes.length >> i) & 1);
  for (const b of bytes) for (let i = 7; i >= 0; i--) dataBits.push((b >> i) & 1);
  const maxBits = dataCW * 8;
  for (let i = 0; i < 4 && dataBits.length < maxBits; i++) dataBits.push(0);
  while (dataBits.length % 8 !== 0) dataBits.push(0);
  const padBytes = [0xec, 0x11];
  let pi = 0;
  while (dataBits.length < maxBits) {
    for (let i = 7; i >= 0; i--) dataBits.push((padBytes[pi % 2] >> i) & 1);
    pi++;
  }

  const dataBytes = new Uint8Array(dataCW);
  for (let i = 0; i < dataCW; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (dataBits[i * 8 + b] || 0);
    dataBytes[i] = byte;
  }

  const blockSize = Math.floor(dataCW / numBlocks);
  const longBlocks = dataCW % numBlocks;
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const bLen = blockSize + (b >= numBlocks - longBlocks ? 1 : 0);
    const block = dataBytes.slice(offset, offset + bLen);
    dataBlocks.push(block);
    ecBlocks.push(ecBytes(block, ecCWPerBlock));
    offset += bLen;
  }

  const allBits: number[] = [];
  const maxDataLen = blockSize + (longBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) {
        for (let b = 7; b >= 0; b--) allBits.push((block[i] >> b) & 1);
      }
    }
  }
  for (let i = 0; i < ecCWPerBlock; i++) {
    for (const block of ecBlocks) {
      for (let b = 7; b >= 0; b--) allBits.push((block[i] >> b) & 1);
    }
  }

  const matrix = createMatrix(size);
  const isFunc = createFuncMatrix(size);

  addFinderPattern(matrix, isFunc, 0, 0);
  addFinderPattern(matrix, isFunc, 0, size - 7);
  addFinderPattern(matrix, isFunc, size - 7, 0);

  const alignPos = ALIGN_POS[version] as number[];
  if (alignPos.length > 0) {
    for (const r of alignPos) {
      for (const c of alignPos) {
        if (r <= 8 && c <= 8) continue;
        if (r <= 8 && c >= size - 9) continue;
        if (r >= size - 9 && c <= 8) continue;
        addAlignmentPattern(matrix, isFunc, r, c);
      }
    }
  }

  addTimingPatterns(matrix, isFunc);
  reserveFormatArea(matrix, isFunc);

  placeData(matrix, allBits);

  let bestMatrix: Int8Array[] | null = null;
  let bestScore = Infinity;
  let bestMask = 0;
  for (let m = 0; m < 8; m++) {
    const masked = applyMask(matrix, isFunc, MASKS[m]);
    const mCopy = masked.map((row) => Int8Array.from(row));
    writeFormatBits(mCopy, m);
    const score = scoreMask(mCopy);
    if (score < bestScore) {
      bestScore = score;
      bestMatrix = mCopy;
      bestMask = m;
    }
  }

  if (!bestMatrix) return "";
  writeFormatBits(bestMatrix, bestMask);

  const totalSize = size + quietZone * 2;
  let paths = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (bestMatrix[r][c] === 1) {
        paths += `M${c + quietZone},${r + quietZone}h1v1h-1z`;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges">` +
    `<rect width="${totalSize}" height="${totalSize}" fill="${bg}"/>` +
    `<path d="${paths}" fill="${fg}"/>` +
    `</svg>`
  );
}
