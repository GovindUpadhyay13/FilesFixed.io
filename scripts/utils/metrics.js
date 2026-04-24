export function getCompressionRatio(originalSize, compressedSize) {
    if (originalSize == null || compressedSize == null) return 'N/A';
    const o = Number(originalSize);
    const c = Number(compressedSize);

    if (o <= 0 || isNaN(o) || isNaN(c)) return '0:1';
    if (c <= 0) return '∞:1';

    const ratio = o / c;
    const formattedRatio = (Math.round(ratio * 100) / 100).toString();
    return `${formattedRatio}:1`;
}

export function getSpaceSavings(originalSize, compressedSize) {
    if (originalSize == null || compressedSize == null) return '0.00%';
    const o = Number(originalSize);
    const c = Number(compressedSize);

    if (o <= 0 || isNaN(o) || isNaN(c)) return '0.00%';

    const savings = ((o - c) / o) * 100;
    return `${savings.toFixed(2)}%`;
}

export function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function calculatePSNR(originalPixels, compressedPixels) {
    if (!originalPixels || !compressedPixels) return 0;
    if (originalPixels.length === 0) return 0;
    if (originalPixels.length !== compressedPixels.length) {
        console.warn("calculatePSNR: Pixel arrays must be the same length.");
        return 0;
    }

    let mse = 0;
    const length = originalPixels.length;

    for (let i = 0; i < length; i++) {
        const diff = originalPixels[i] - compressedPixels[i];
        mse += diff * diff;
    }

    mse = mse / length;

    if (mse === 0) return Infinity;

    const MAX_I = 255;
    return 10 * Math.log10((MAX_I * MAX_I) / mse);
}

export function calculateSSIM(originalPixels, compressedPixels) {
  if (!originalPixels || !compressedPixels) return 0;
  if (originalPixels.length === 0) return 0;
  if (originalPixels.length !== compressedPixels.length) {
    console.warn("calculateSSIM: Pixel arrays must be the same length.");
    return 0;
  }

  const windowSize = 11;
  const sigma = 1.5;
  const L = 255; // Dynamic range
  const c1 = (0.01 * L) ** 2;
  const c2 = (0.03 * L) ** 2;

  let ssimValues = [];
  const stride = 4; // RGBA channels

  for (let i = 0; i < originalPixels.length; i += stride * windowSize) {
    if (i + stride * windowSize > originalPixels.length) break;

    let meanOrig = 0, meanComp = 0;

    // Calculate local means
    for (let j = 0; j < stride * windowSize; j += stride) {
      if (i + j < originalPixels.length) {
        meanOrig += originalPixels[i + j];
        meanComp += compressedPixels[i + j];
      }
    }
    meanOrig /= windowSize;
    meanComp /= windowSize;

    // Calculate variances and covariance
    let varOrig = 0, varComp = 0, covar = 0;
    for (let j = 0; j < stride * windowSize; j += stride) {
      if (i + j < originalPixels.length) {
        const diffOrig = originalPixels[i + j] - meanOrig;
        const diffComp = compressedPixels[i + j] - meanComp;
        varOrig += diffOrig * diffOrig;
        varComp += diffComp * diffComp;
        covar += diffOrig * diffComp;
      }
    }

    varOrig /= windowSize;
    varComp /= windowSize;
    covar /= windowSize;

    // SSIM formula
    const numerator = (2 * meanOrig * meanComp + c1) * (2 * covar + c2);
    const denominator = (meanOrig ** 2 + meanComp ** 2 + c1) * (varOrig + varComp + c2);
    
    if (denominator === 0) {
      ssimValues.push(1.0);
    } else {
      ssimValues.push(numerator / denominator);
    }
  }

  if (ssimValues.length === 0) return 0;
  
  const avgSSIM = ssimValues.reduce((a, b) => a + b, 0) / ssimValues.length;
  return parseFloat(Math.max(0, Math.min(1, avgSSIM)).toFixed(4));
}