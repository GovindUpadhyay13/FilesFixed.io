import { getCompressionRatio, getSpaceSavings, formatBytes, calculatePSNR } from '../../utils/metrics.js';

let _ffmpegInstance = null;
let _ffmpegLoading = false;

async function decodeImageBytesToRGBA(bytes) {
    return new Promise((resolve, reject) => {
        const blob = new Blob([bytes], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;

                const context = canvas.getContext('2d');
                context.drawImage(img, 0, 0);

                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve({ width: canvas.width, height: canvas.height, data: imageData.data });
            } catch (error) {
                URL.revokeObjectURL(url);
                reject(error);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to decode extracted video frame.'));
        };

        img.src = url;
    });
}

async function extractFirstFrame(ffmpeg, inputName, frameName) {
    await ffmpeg.run(
        '-i', inputName,
        '-vf', 'select=eq(n\\,0)',
        '-vframes', '1',
        '-q:v', '2',
        '-y', frameName
    );

    return ffmpeg.FS('readFile', frameName);
}

async function calculateVideoPSNR(ffmpeg, originalName, rebuiltName) {
    const originalFrameName = 'video_original_frame.png';
    const rebuiltFrameName = 'video_rebuilt_frame.png';

    try {
        const originalFrame = await extractFirstFrame(ffmpeg, originalName, originalFrameName);
        const rebuiltFrame = await extractFirstFrame(ffmpeg, rebuiltName, rebuiltFrameName);

        const originalImage = await decodeImageBytesToRGBA(originalFrame);
        const rebuiltImage = await decodeImageBytesToRGBA(rebuiltFrame);

        if (originalImage.width !== rebuiltImage.width || originalImage.height !== rebuiltImage.height) {
            return null;
        }

        const psnr = calculatePSNR(originalImage.data, rebuiltImage.data);
        if (!Number.isFinite(psnr)) return 'Infinity';
        return parseFloat(psnr.toFixed(2));
    } catch (error) {
        console.warn('Video PSNR calculation skipped:', error);
        return null;
    } finally {
        try { ffmpeg.FS('unlink', originalFrameName); } catch (_) { }
        try { ffmpeg.FS('unlink', rebuiltFrameName); } catch (_) { }
    }
}

async function getFFmpeg() {
    if (_ffmpegInstance && _ffmpegInstance.isLoaded()) return _ffmpegInstance;
    if (_ffmpegLoading) throw new Error("FFmpeg is already loading, please wait.");
    
    _ffmpegLoading = true;
    try {
        const FFmpegLib = window.FFmpeg || window.FFmpegWASM || window;
        const createFFmpeg = FFmpegLib.createFFmpeg || FFmpegLib.FFmpeg;

        if (!createFFmpeg) {
            throw new Error('ffmpeg.wasm not found. Ensure lib/ffmpeg.min.js is loaded in popup.html.');
        }

        const coreUrl = chrome.runtime.getURL('lib/ffmpeg-core.js');
        const wasmUrl = chrome.runtime.getURL('lib/ffmpeg-core.wasm');

        _ffmpegInstance = createFFmpeg({
            corePath: coreUrl,
            wasmPath: wasmUrl,
            workerPath: coreUrl, 
            mainName: 'main', 
            log: true, 
        });

        await _ffmpegInstance.load();
        _ffmpegLoading = false;
        return _ffmpegInstance;
    } catch (err) {
        _ffmpegLoading = false;
        console.error("FFmpeg Load Error:", err);
        throw new Error(`WASM Boot Failed: ${err.message}`); 
    }
}

export async function compressMP4(file, options = {}) {
  // ===== DETERMINE COMPRESSION LEVEL (CRF VALUE) =====
  let crf = 28; // Default to BALANCED mode

  if (options && options.level) {
    const level = parseInt(options.level);
    
    // Map compression level (1-10) to CRF (51-18)
    // Lower CRF = better quality but slower
    // Higher CRF = worse quality but faster
    if (level <= 2) {
      crf = 51; // Ultra fast, low quality
    } else if (level <= 4) {
      crf = 42; // Very fast
    } else if (level <= 6) {
      crf = 28; // Balanced (default)
    } else if (level <= 8) {
      crf = 23; // Better quality
    } else {
      crf = 18; // Best quality, slowest
    }
  }

  console.log("Files.io: Video compression with CRF " + crf);
    const ffmpeg = await getFFmpeg();

    const inputName = 'input.mp4';
    const outputName = 'output.mp4';

        const arrayBuffer = await file.arrayBuffer();
        ffmpeg.FS('writeFile', inputName, new Uint8Array(arrayBuffer));

    try {
// ===== DETERMINE PRESET BASED ON CRF =====
let preset = 'ultrafast'; // Default for fast modes

if (crf <= 23) {
  preset = 'slow'; // Slower preset for better compression
} else if (crf <= 28) {
  preset = 'medium'; // Medium preset for balanced
}

// Then in ffmpeg.run(), use:
await ffmpeg.run(
  '-i', inputName, 
  '-c:v', 'libx264', 
  '-crf', String(crf), 
  '-preset', preset,  // ← Use the variable here
  '-c:a', 'aac', 
  '-b:a', '128k', 
  '-y', outputName
);
    } catch (e) {
        if (e && e.message && !e.message.includes('exit(0)')) throw e;
    }

    const compressedData = ffmpeg.FS('readFile', outputName);
    const blob = new Blob([compressedData], { type: 'video/mp4' });

    const psnr = await calculateVideoPSNR(ffmpeg, inputName, outputName);

    try { ffmpeg.FS('unlink', inputName); } catch (_) { }
    try { ffmpeg.FS('unlink', outputName); } catch (_) { }

    return {
        blob: blob,
        psnr,
        metrics: {
            originalSize: formatBytes(file.size),
            compressedSize: formatBytes(blob.size),
            ratio: getCompressionRatio(file.size, blob.size),
            savings: getSpaceSavings(file.size, blob.size)
        },
    };
}

export async function decompressMP4(file) {
    const ffmpeg = await getFFmpeg();
    const inputName = 'decomp_input.mp4';
    const outputName = 'decomp_output.mp4';

    const arrayBuffer = await file.arrayBuffer();
    ffmpeg.FS('writeFile', inputName, new Uint8Array(arrayBuffer));
    
    try {
        await ffmpeg.run(
            '-i', inputName, 
            '-c:v', 'libx264',
            '-crf', '18',
            '-preset', 'slow',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            '-y', outputName
        );
    } catch (e) {
        if (e && e.message && !e.message.includes('exit(0)')) throw e;
    }

    const decompressedData = ffmpeg.FS('readFile', outputName);
    const blob = new Blob([decompressedData], { type: 'video/mp4' });

    const psnr = await calculateVideoPSNR(ffmpeg, inputName, outputName);

    try { ffmpeg.FS('unlink', inputName); } catch (_) { }
    try { ffmpeg.FS('unlink', outputName); } catch (_) { }

    return {
        blob: blob,
        psnr,
        metrics: {
            originalSize: formatBytes(file.size),
            compressedSize: formatBytes(blob.size),
            ratio: getCompressionRatio(file.size, blob.size),
            savings: getSpaceSavings(file.size, blob.size)
        }
    };
}