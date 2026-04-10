// Copyright (c) 2026 maxfrost1308
// Licensed under AGPL-3.0. See LICENSE in the project root.
/**
 * Minimal QR Code generator — produces SVG markup from text/URL.
 * Self-contained, no external dependencies.
 *
 * Based on the QR code specification (ISO/IEC 18004).
 * Supports alphanumeric & byte mode, error correction level M, versions 1-10.
 */

// ---- Galois Field GF(256) arithmetic ----
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

/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : EXP[(LOG[a] + LOG[b]) % 255];
}

/**
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 */
function polyMul(a, b) {
  const result = new Uint8Array(a.length + b.length - 1);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) result[i + j] ^= gfMul(a[i], b[j]);
  return result;
}

/**
 * @param {number} n
 * @returns {Uint8Array}
 */
function genPoly(n) {
  let g = new Uint8Array([1]);
  for (let i = 0; i < n; i++) g = polyMul(g, new Uint8Array([1, EXP[i]]));
  return g;
}

/**
 * @param {Uint8Array} data
 * @param {number} ecLen
 * @returns {Uint8Array}
 */
function ecBytes(data, ecLen) {
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

// ---- QR structure tables (Error correction level M) ----
// [totalCodewords, ecCodewordsPerBlock, numBlocks, dataCodewords]
const VERSION_TABLE = [
  null, // v0 placeholder
  [26, 10, 1, 16], // v1 (21x21)
  [44, 16, 1, 28], // v2
  [70, 26, 1, 44], // v3
  [100, 18, 2, 64], // v4
  [134, 24, 2, 86], // v5
  [172, 16, 4, 108], // v6
  [196, 18, 4, 124], // v7
  [242, 24, 4, 154], // v8
  [292, 30, 4, 182], // v9
  [346, 18, 6, 216], // v10 (57x57)
];

/**
 * @param {number} dataLen
 * @returns {number|null}
 */
function getVersion(dataLen) {
  // Byte mode overhead: 4 (mode) + 8 or 16 (length) bits
  for (let v = 1; v <= 10; v++) {
    const lenBits = v <= 9 ? 8 : 16;
    const dataBits = 4 + lenBits + dataLen * 8;
    const dataBytes = /** @type {number[]} */ (VERSION_TABLE[v])[3];
    if (dataBits <= dataBytes * 8) return v;
  }
  return null; // too long
}

// Alignment pattern positions per version
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

// Format info bits for mask 0-7 at EC level M (pre-computed with BCH)
const FORMAT_BITS = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];

// ---- Matrix operations ----
// We use two matrices:
//   matrix:   0=unset, 1=black, -1=white
//   isFunc:   true if the cell is a function pattern (finder, alignment, timing, format)
//             Mask should NOT be applied to function pattern cells.
/**
 * @param {number} size
 * @returns {Int8Array[]}
 */
function createMatrix(size) {
  return Array.from({ length: size }, () => new Int8Array(size));
}

/**
 * @param {number} size
 * @returns {Uint8Array[]}
 */
function createFuncMatrix(size) {
  return Array.from({ length: size }, () => new Uint8Array(size)); // 0=data, 1=function
}

/**
 * @param {Int8Array[]} matrix
 * @param {number} r
 * @param {number} c
 * @param {boolean|number} val
 */
function setModule(matrix, r, c, val) {
  matrix[r][c] = val ? 1 : -1;
}

/**
 * @param {Int8Array[]} matrix
 * @param {Uint8Array[]} isFunc
 * @param {number} row
 * @param {number} col
 */
function addFinderPattern(matrix, isFunc, row, col) {
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

/**
 * @param {Int8Array[]} matrix
 * @param {Uint8Array[]} isFunc
 * @param {number} row
 * @param {number} col
 */
function addAlignmentPattern(matrix, isFunc, row, col) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const isBlack = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
      setModule(matrix, row + r, col + c, isBlack);
      isFunc[row + r][col + c] = 1;
    }
  }
}

/**
 * @param {Int8Array[]} matrix
 * @param {Uint8Array[]} isFunc
 */
function addTimingPatterns(matrix, isFunc) {
  const n = matrix.length;
  for (let i = 8; i < n - 8; i++) {
    setModule(matrix, 6, i, i % 2 === 0);
    setModule(matrix, i, 6, i % 2 === 0);
    isFunc[6][i] = 1;
    isFunc[i][6] = 1;
  }
}

/**
 * @param {Int8Array[]} matrix
 * @param {Uint8Array[]} isFunc
 */
function reserveFormatArea(matrix, isFunc) {
  const n = matrix.length;
  // Around top-left finder
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === 0) setModule(matrix, 8, i, false);
    if (matrix[i][8] === 0) setModule(matrix, i, 8, false);
    isFunc[8][i] = 1;
    isFunc[i][8] = 1;
  }
  // Around top-right finder
  for (let i = 0; i < 8; i++) {
    if (matrix[8][n - 1 - i] === 0) setModule(matrix, 8, n - 1 - i, false);
    isFunc[8][n - 1 - i] = 1;
  }
  // Around bottom-left finder
  for (let i = 0; i < 7; i++) {
    if (matrix[n - 1 - i][8] === 0) setModule(matrix, n - 1 - i, 8, false);
    isFunc[n - 1 - i][8] = 1;
  }
  // Dark module
  setModule(matrix, n - 8, 8, true);
  isFunc[n - 8][8] = 1;
}

/**
 * @param {Int8Array[]} matrix
 * @param {number[]} bits
 */
function placeData(matrix, bits) {
  const n = matrix.length;
  let bitIdx = 0;
  let upward = true;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip timing column
    const rows = upward ? Array.from({ length: n }, (_, i) => n - 1 - i) : Array.from({ length: n }, (_, i) => i);
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

/**
 * @param {Int8Array[]} matrix
 * @param {Uint8Array[]} isFunc
 * @param {(r: number, c: number) => boolean} maskFn
 * @returns {Int8Array[]}
 */
function applyMask(matrix, isFunc, maskFn) {
  const n = matrix.length;
  const result = matrix.map((row) => Int8Array.from(row));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      // Only mask data modules — skip function pattern cells
      if (!isFunc[r][c] && matrix[r][c] !== 0 && maskFn(r, c)) {
        result[r][c] = result[r][c] === 1 ? -1 : 1;
      }
    }
  }
  return result;
}

/**
 * @param {Int8Array[]} matrix
 * @param {number} maskIdx
 */
function writeFormatBits(matrix, maskIdx) {
  const n = matrix.length;
  const bits = FORMAT_BITS[maskIdx];
  // Horizontal (row 8)
  const hCols = [0, 1, 2, 3, 4, 5, 7, 8, n - 8, n - 7, n - 6, n - 5, n - 4, n - 3, n - 2, n - 1];
  for (let i = 0; i < 15; i++) {
    setModule(matrix, 8, hCols[i], (bits >> i) & 1);
  }
  // Vertical (col 8)
  const vRows = [n - 1, n - 2, n - 3, n - 4, n - 5, n - 6, n - 7, n - 8, 7, 5, 4, 3, 2, 1, 0];
  for (let i = 0; i < 15; i++) {
    setModule(matrix, vRows[i], 8, (bits >> i) & 1);
  }
}

// Mask functions
/** @type {Array<(r: number, c: number) => boolean>} */
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/**
 * @param {Int8Array[]} matrix
 * @returns {number}
 */
function scoreMask(matrix) {
  const n = matrix.length;
  let penalty = 0;
  // Rule 1: consecutive same-color modules in row/col
  for (let r = 0; r < n; r++) {
    let count = 1;
    for (let c = 1; c < n; c++) {
      if (matrix[r][c] > 0 === matrix[r][c - 1] > 0) {
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
      if (matrix[r][c] > 0 === matrix[r - 1][c] > 0) {
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

// ---- Public API ----

/**
 * Generate a QR code SVG string for the given text.
 * Returns an SVG element string with viewBox matching the QR matrix size.
 *
 * @param {string} text - The text or URL to encode
 * @param {object} [options]
 * @param {string} [options.fg='#000'] - Foreground (dark module) color
 * @param {string} [options.bg='#fff'] - Background color
 * @param {number} [options.quietZone=2] - Quiet zone modules around QR
 * @returns {string} SVG markup string, or empty string on failure
 */
export function generateQrSvg(text, options = {}) {
  if (!text || typeof text !== 'string') return '';
  const { fg = '#000', bg = '#fff', quietZone = 2 } = options;

  // Encode as byte mode
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const version = getVersion(bytes.length);
  if (!version) return ''; // too long for v1-10

  const vInfo = /** @type {number[]} */ (VERSION_TABLE[version]);
  const [totalCW, ecCWPerBlock, numBlocks, dataCW] = vInfo;
  const size = 17 + version * 4;

  // Build data bitstream
  const lenBits = version <= 9 ? 8 : 16;
  const dataBits = [];
  // Mode indicator: byte mode = 0100
  dataBits.push(0, 1, 0, 0);
  // Character count
  for (let i = lenBits - 1; i >= 0; i--) dataBits.push((bytes.length >> i) & 1);
  // Data
  for (const b of bytes) for (let i = 7; i >= 0; i--) dataBits.push((b >> i) & 1);
  // Terminator (up to 4 bits)
  const maxBits = dataCW * 8;
  for (let i = 0; i < 4 && dataBits.length < maxBits; i++) dataBits.push(0);
  // Byte-align
  while (dataBits.length % 8 !== 0) dataBits.push(0);
  // Pad bytes
  const padBytes = [0xec, 0x11];
  let pi = 0;
  while (dataBits.length < maxBits) {
    for (let i = 7; i >= 0; i--) dataBits.push((padBytes[pi % 2] >> i) & 1);
    pi++;
  }

  // Convert bits to bytes
  const dataBytes = new Uint8Array(dataCW);
  for (let i = 0; i < dataCW; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (dataBits[i * 8 + b] || 0);
    dataBytes[i] = byte;
  }

  // Error correction
  const blockSize = Math.floor(dataCW / numBlocks);
  const longBlocks = dataCW % numBlocks;
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const bLen = blockSize + (b >= numBlocks - longBlocks ? 1 : 0);
    const block = dataBytes.slice(offset, offset + bLen);
    dataBlocks.push(block);
    ecBlocks.push(ecBytes(block, ecCWPerBlock));
    offset += bLen;
  }

  // Interleave
  const allBits = [];
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

  // Build matrix and function-pattern tracking matrix
  const matrix = createMatrix(size);
  const isFunc = createFuncMatrix(size);

  // Finder patterns
  addFinderPattern(matrix, isFunc, 0, 0);
  addFinderPattern(matrix, isFunc, 0, size - 7);
  addFinderPattern(matrix, isFunc, size - 7, 0);

  // Alignment patterns
  const alignPos = /** @type {number[]} */ (ALIGN_POS[version]);
  if (alignPos.length > 0) {
    for (const r of alignPos) {
      for (const c of alignPos) {
        // Skip if overlapping finder patterns
        if (r <= 8 && c <= 8) continue;
        if (r <= 8 && c >= size - 9) continue;
        if (r >= size - 9 && c <= 8) continue;
        addAlignmentPattern(matrix, isFunc, r, c);
      }
    }
  }

  addTimingPatterns(matrix, isFunc);
  reserveFormatArea(matrix, isFunc);

  // Place data
  placeData(matrix, allBits);

  // Try all masks, pick the best
  /** @type {Int8Array[]|null} */
  let bestMatrix = null;
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

  if (!bestMatrix) return '';
  writeFormatBits(bestMatrix, bestMask);

  // Render SVG
  const totalSize = size + quietZone * 2;
  let paths = '';
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
