/**
 * Files.io JPEG Compression Module
 * Handles lossy JPEG compression with quality metrics
 * PSNR is calculated and returned for metadata storage
 */
import { getCompressionRatio, getSpaceSavings, formatBytes } from '../../utils/metrics.js';

function getJpegJs() {
    const lib = window.jpegJs || window.jpegjs || window.jpeg_js || window.JpegJs;
    if (!lib) throw new Error('jpeg-js library not found. Ensure lib/jpeg-js.min.js is loaded.');
    return lib;
}

function readFileAsUint8Array(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = e => resolve(new Uint8Array(e.target.result));
        reader.onerror = ()  => reject(new Error('FileReader failed'));
        reader.readAsArrayBuffer(file);
    });
}

async function decodeToRawRGBA(bytes, mimeType) {
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        const decoded = getJpegJs().decode(bytes, { useTArray: true, formatAsRGBA: true });
        return { width: decoded.width, height: decoded.height, data: decoded.data };
    }
    return new Promise((resolve, reject) => {
        const blob = new Blob([bytes], { type: mimeType });
        const url  = URL.createObjectURL(blob);
        const img  = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width  = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve({ width: canvas.width, height: canvas.height, data: imageData.data });
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Canvas decode failed')); };
        img.src = url;
    });
}

function encodeToJpeg(rawImage, quality) {
    const frameData = {
        width : rawImage.width,
        height: rawImage.height,
        data  : rawImage.data instanceof Uint8Array ? rawImage.data : new Uint8Array(rawImage.data.buffer)
    };
    return getJpegJs().encode(frameData, quality).data;
}

function calculatePSNR(orig, comp, pixelCount) {
    let sumSquaredError = 0;
    const n = pixelCount * 4; 
    for (let i = 0; i < n; i += 4) {
        const dr = orig[i]     - comp[i];
        const dg = orig[i + 1] - comp[i + 1];
        const db = orig[i + 2] - comp[i + 2];
        sumSquaredError += dr * dr + dg * dg + db * db;
    }
    const mse = sumSquaredError / (3 * pixelCount);
    if (mse === 0) return Infinity;
    return 10 * Math.log10((255 * 255) / mse);
}

export async function compressJPG(file, options = {}) {
    const quality = Math.min(100, Math.max(1, options.quality ?? 50)); 
    const originalBytes = await readFileAsUint8Array(file);
    const mimeType  = file.type || 'image/jpeg';
    const rawImage  = await decodeToRawRGBA(originalBytes, mimeType);
    
    const compressedBytes = encodeToJpeg(rawImage, quality);
    const blob = new Blob([compressedBytes], { type: 'image/jpeg' });

    let psnr = null;
    try {
        const reDecoded = getJpegJs().decode(compressedBytes, { useTArray: true, formatAsRGBA: true });
        psnr = calculatePSNR(rawImage.data, reDecoded.data, rawImage.width * rawImage.height);
    } catch (e) {
        console.warn('ImageJpgCompressor: PSNR calculation skipped.');
    }

    return {
        blob: blob,
        psnr: psnr !== null ? parseFloat(psnr.toFixed(2)) : null,
        metrics: {
            originalSize: formatBytes(file.size),
            compressedSize: formatBytes(blob.size),
            ratio: getCompressionRatio(file.size, blob.size),
            savings: getSpaceSavings(file.size, blob.size)
        }
    };
}

export async function decompressJPG(file) {
    const compressedBytes = await readFileAsUint8Array(file);
    const rawImage = getJpegJs().decode(compressedBytes, { useTArray: true, formatAsRGBA: true });
    const decompressedBytes = encodeToJpeg(rawImage, 100);
    const blob = new Blob([decompressedBytes], { type: 'image/jpeg' });

    return {
        blob: blob,
        metrics: {
            originalSize: formatBytes(compressedBytes.length),
            compressedSize: formatBytes(decompressedBytes.length),
            ratio: getCompressionRatio(decompressedBytes.length, compressedBytes.length),
            savings: getSpaceSavings(decompressedBytes.length, compressedBytes.length)
        }
    };
}