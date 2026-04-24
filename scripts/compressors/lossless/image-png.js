/**
 * Files.io PNG Compression Module
 * Handles lossless PNG compression
 * Built by SMG
 */
import { getCompressionRatio, getSpaceSavings, formatBytes } from '../../utils/metrics.js';

function getUPNG() {
    const lib = window.UPNG || window.upng;
    if (!lib) {
        throw new Error('UPNG library not found. Ensure lib/upng.min.js is loaded in popup.html before dom-handler.js.');
    }
    return lib;
}

export async function compressLosslessPNG(file) {
  try {
    const upng = getUPNG();
    
    const arrayBuffer = await file.arrayBuffer();
    const decodedImg = upng.decode(arrayBuffer);

    const width = decodedImg.width;
    const height = decodedImg.height;

    const frames = upng.toRGBA8(decodedImg);

    const compressedBuffer = upng.encode(frames, width, height, 0);
    
    const blob = new Blob([compressedBuffer], { type: 'image/png' });

    return {
      blob: blob,
      metrics: {
        originalSize: formatBytes(file.size),
        compressedSize: formatBytes(blob.size),
        ratio: getCompressionRatio(file.size, blob.size),
        savings: getSpaceSavings(file.size, blob.size)
      }
    };
  } catch (error) {
    console.error('Failed to compress PNG losslessly:', error);
    throw error;
  }
}