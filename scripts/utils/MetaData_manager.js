/**
 * Files.io Metadata Manager Module
 * Handles embedding and extracting metadata from compressed files
 */

const DELIMITER = "===FILES.IO_METADATA_V1===";

export const MetaDataManager = {
    async generateMetadata(originalFile, compressedBlob, metrics, additionalData = {}) {
        const originalSize = originalFile.size;
        const compressedSize = compressedBlob.size;
        
        let ratio = metrics.ratio;
        let savings = metrics.savings;
        
        if (!ratio || ratio === 'N/A') {
            ratio = (originalSize / compressedSize).toFixed(2) + ":1";
        }
        
        if (!savings || savings === 'N/A') {
            savings = (((originalSize - compressedSize) / originalSize) * 100).toFixed(2) + "%";
        }

        const metadata = {
            originalFilename: originalFile.name,
            originalSize,
            compressedSize,
            compressionRatio: ratio,
            spaceSaved: savings,
            timestamp: new Date().toISOString(),
            ...additionalData
        };

        return metadata;
    },

    async embedMetadata(compressedBlob, metadata) {
        try {
            const metadataStr = JSON.stringify(metadata);
            
            const metadataBytes = new TextEncoder().encode(DELIMITER + metadataStr);
            const compressedArrayBuffer = await compressedBlob.arrayBuffer();
            
            const combinedBlob = new Blob([compressedArrayBuffer, metadataBytes], { type: compressedBlob.type });
            return combinedBlob;
        } catch (error) {
            console.error("Error embedding metadata:", error);
            return compressedBlob; 
        }
    },

    async extractMetadata(compressedBlob) {
        try {
            const arrayBuffer = await compressedBlob.arrayBuffer();
            const textDecoder = new TextDecoder();
            
            const tailSize = Math.min(arrayBuffer.byteLength, 1024 * 10); 
            const tailBytes = new Uint8Array(arrayBuffer, arrayBuffer.byteLength - tailSize, tailSize);
            const tailString = textDecoder.decode(tailBytes);
            
            const delimiterIndex = tailString.lastIndexOf(DELIMITER);
            
            if (delimiterIndex !== -1) {
                const metadataJson = tailString.substring(delimiterIndex + DELIMITER.length);
                const metadata = JSON.parse(metadataJson);
                
                const absoluteDelimiterIndex = arrayBuffer.byteLength - tailSize + delimiterIndex;
                const originalCompressedData = new Uint8Array(arrayBuffer, 0, absoluteDelimiterIndex);
                
                return {
                    metadata: metadata,
                    compressedData: originalCompressedData
                };
            }
            
            return { metadata: null, compressedData: new Uint8Array(arrayBuffer) };
        } catch (error) {
            console.error("Error extracting metadata:", error);
            const data = await compressedBlob.arrayBuffer();
            return { metadata: null, compressedData: new Uint8Array(data) };
        }
    },

    async validateMetadata(metadata, decompressedData) {
        if (!metadata) return { verified: false, msg: "No metadata found." };
        
        if (metadata.isLossy === false && metadata.sha256) {
            const computedHash = await crypto.subtle.digest('SHA-256', decompressedData);
            const hashArray = Array.from(new Uint8Array(computedHash));
            const computedHashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            if (computedHashHex === metadata.sha256) {
                return { match: true, verified: true, computed: computedHashHex, expected: metadata.sha256 };
            } else {
                return { match: false, verified: false, computed: computedHashHex, expected: metadata.sha256 };
            }
        }
        
        if (metadata.psnr || metadata.ssim) {
            const qualityText = `Lossy comp. PSNR: ${metadata.psnr ? metadata.psnr.toFixed(2) : 'N/A'}`;
            return { psnr: metadata.psnr, ssim: metadata.ssim, qualityText: qualityText, verified: true };
        }
        
        return { verified: true, msg: "Decompressed", computed: "" };
    },

    formatMetadataForDisplay(metadata) {
        if (!metadata) return null;
        
        const formatBytes = (bytes) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        return {
            filename: metadata.originalFilename,
            originalSizeFormatted: formatBytes(metadata.originalSize),
            compressedSizeFormatted: formatBytes(metadata.compressedSize),
            ratio: metadata.compressionRatio,
            savings: metadata.spaceSaved,
            timestamp: new Date(metadata.timestamp).toLocaleString(),
            isLossy: metadata.isLossy ? "Yes" : "No",
            algorithm: metadata.algorithm || "Unknown"
        };
    }
};