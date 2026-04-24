/**
 * Files.io Metadata Manager
 * Handles embedding and extraction of compression metadata
 * Stores file information for integrity verification
 * Built by SMG
 */

import { computeSHA256, verifySHA256 } from './crypto-hash.js';

export class MetaDataManager {
  /**
   * Metadata delimiter to separate compressed data from metadata
   * @private
   */
  static METADATA_DELIMITER = '===FILES.IO_METADATA_V1===';

  /**
   * Metadata version for compatibility
   * @private
   */
  static METADATA_VERSION = '1.0';

  constructor() {
    this.metadata = null;
  }

  /**
   * Generate metadata object for a file
   * @param {File} originalFile - Original file before compression
   * @param {Blob} compressedBlob - Compressed file blob
   * @param {Object} metrics - Metrics object with compression data
   * @param {Object} additionalData - Additional data (psnr, ssim, hash, algorithm, level)
   * @returns {Promise<Object>} Complete metadata object
   */
  async generateMetadata(originalFile, compressedBlob, metrics, additionalData = {}) {
    try {
      const originalSize = originalFile.size;
      const compressedSize = compressedBlob.size;

      // Calculate compression ratio
      const ratio = originalSize > 0 ? (originalSize / compressedSize).toFixed(2) : 0;
      
      // Calculate space saved percentage
      const spaceSaved = originalSize > 0 
        ? ((originalSize - compressedSize) / originalSize * 100).toFixed(2)
        : 0;

      // Get current timestamp in ISO 8601 format
      const timestamp = new Date().toISOString();

      // Generate SHA-256 hash for lossless files
      let sha256Hash = null;
      if (additionalData.sha256) {
        sha256Hash = additionalData.sha256;
      } else if (additionalData.isLossy === false) {
        // For lossless files, generate hash if not provided
        const arrayBuffer = await compressedBlob.arrayBuffer();
        sha256Hash = await computeSHA256(arrayBuffer);
      }

      // Create metadata object
      const metadata = {
        version: MetaDataManager.METADATA_VERSION,
        originalFilename: originalFile.name,
        originalSize: originalSize,
        compressedSize: compressedSize,
        compressionRatio: `${ratio}:1`,
        spaceSaved: `${spaceSaved}%`,
        algorithm: additionalData.algorithm || 'unknown',
        timestamp: timestamp,
        compressionLevel: additionalData.compressionLevel || 'default',
        isLossy: additionalData.isLossy || false,
        sha256: sha256Hash,
        psnr: additionalData.psnr || null,
        ssim: additionalData.ssim || null
      };

      this.metadata = metadata;
      return metadata;
    } catch (error) {
      console.error('MetaDataManager.generateMetadata() error:', error);
      throw new Error('Failed to generate metadata: ' + error.message);
    }
  }

  /**
   * Embed metadata into compressed blob
   * Combines compressed data + delimiter + metadata JSON
   * @param {Blob} compressedBlob - Compressed file blob
   * @param {Object} metadata - Metadata object
   * @returns {Promise<Blob>} New blob with embedded metadata
   */
  async embedMetadata(compressedBlob, metadata) {
    try {
      // Convert compressed blob to Uint8Array
      const compressedArrayBuffer = await compressedBlob.arrayBuffer();
      const compressedData = new Uint8Array(compressedArrayBuffer);

      // Convert metadata to JSON string
      const metadataJSON = JSON.stringify(metadata);

      // Convert metadata string to Uint8Array
      const metadataEncoder = new TextEncoder();
      const metadataBytes = metadataEncoder.encode(metadataJSON);

      // Convert delimiter to Uint8Array
      const delimiterBytes = metadataEncoder.encode(MetaDataManager.METADATA_DELIMITER);

      // Calculate total size
      const totalSize = compressedData.length + delimiterBytes.length + metadataBytes.length;

      // Create combined array
      const combinedData = new Uint8Array(totalSize);
      let offset = 0;

      // Copy compressed data
      combinedData.set(compressedData, offset);
      offset += compressedData.length;

      // Copy delimiter
      combinedData.set(delimiterBytes, offset);
      offset += delimiterBytes.length;

      // Copy metadata
      combinedData.set(metadataBytes, offset);

      // Create new blob with combined data
      const embeddedBlob = new Blob([combinedData], { type: compressedBlob.type });

      console.log('Files.io: Metadata embedded successfully');
      console.log(`Original size: ${compressedBlob.size} bytes, Embedded size: ${embeddedBlob.size} bytes`);

      return embeddedBlob;
    } catch (error) {
      console.error('MetaDataManager.embedMetadata() error:', error);
      throw new Error('Failed to embed metadata: ' + error.message);
    }
  }

  /**
   * Extract metadata from compressed blob
   * @param {Blob} compressedBlob - Blob that might contain embedded metadata
   * @returns {Promise<Object>} Object with {metadata, compressedData}
   */
  async extractMetadata(compressedBlob) {
    try {
      // Convert blob to ArrayBuffer
      const arrayBuffer = await compressedBlob.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Convert to string to search for delimiter
      const decoder = new TextDecoder();
      const fullText = decoder.decode(data);

      // Search for delimiter
      const delimiterIndex = fullText.indexOf(MetaDataManager.METADATA_DELIMITER);

      if (delimiterIndex === -1) {
        // No metadata found
        console.log('Files.io: No embedded metadata found in file');
        return {
          metadata: null,
          compressedData: data,
          hasMetadata: false
        };
      }

      // Extract compressed data (everything before delimiter)
      const compressedDataEnd = delimiterIndex;
      const compressedData = data.slice(0, compressedDataEnd);

      // Extract metadata JSON (everything after delimiter)
      const metadataStart = delimiterIndex + MetaDataManager.METADATA_DELIMITER.length;
      const metadataBytes = data.slice(metadataStart);
      const metadataJSON = decoder.decode(metadataBytes);

      // Parse metadata
      let metadata = null;
      try {
        metadata = JSON.parse(metadataJSON);
        console.log('Files.io: Metadata extracted successfully');
      } catch (parseError) {
        console.warn('Files.io: Failed to parse metadata JSON:', parseError);
        return {
          metadata: null,
          compressedData: data,
          hasMetadata: false
        };
      }

      return {
        metadata: metadata,
        compressedData: compressedData,
        hasMetadata: true
      };
    } catch (error) {
      console.error('MetaDataManager.extractMetadata() error:', error);
      return {
        metadata: null,
        compressedData: null,
        hasMetadata: false,
        error: error.message
      };
    }
  }

  /**
   * Validate metadata and verify file integrity
   * @param {Object} metadata - Extracted metadata
   * @param {Uint8Array} decompressedData - Decompressed file data
   * @param {string} fileType - Type of file (lossless or lossy)
   * @returns {Promise<Object>} Verification result
   */
  async validateMetadata(metadata, decompressedData, fileType) {
    try {
      if (!metadata) {
        return {
          isValid: false,
          hasMetadata: false,
          message: 'No metadata found in file'
        };
      }

      // For lossless files - verify SHA-256
      if (fileType === 'lossless' || !metadata.isLossy) {
        if (metadata.sha256) {
          try {
            const computedHash = await computeSHA256(decompressedData);
            const hashMatch = computedHash === metadata.sha256;

            return {
              isValid: hashMatch,
              hasMetadata: true,
              type: 'lossless',
              verification: {
                match: hashMatch,
                computed: computedHash,
                expected: metadata.sha256
              },
              message: hashMatch 
                ? '✅ File verified - Lossless rebuild confirmed'
                : '❌ SHA-256 mismatch - File may be corrupted'
            };
          } catch (hashError) {
            console.error('SHA-256 verification error:', hashError);
            return {
              isValid: false,
              hasMetadata: true,
              type: 'lossless',
              error: 'Failed to verify SHA-256',
              message: '⚠️ Could not verify file integrity'
            };
          }
        } else {
          return {
            isValid: true,
            hasMetadata: true,
            type: 'lossless',
            message: 'Decompressed successfully (no hash available)',
            verification: null
          };
        }
      }

      // For lossy files - show quality metrics
      if (fileType === 'lossy' || metadata.isLossy) {
        return {
          isValid: true,
          hasMetadata: true,
          type: 'lossy',
          quality: {
            psnr: metadata.psnr,
            ssim: metadata.ssim
          },
          message: this.getQualityMessage(metadata.psnr, metadata.ssim)
        };
      }

      return {
        isValid: true,
        hasMetadata: true,
        message: 'Decompressed successfully'
      };
    } catch (error) {
      console.error('MetaDataManager.validateMetadata() error:', error);
      return {
        isValid: false,
        hasMetadata: false,
        error: error.message,
        message: '⚠️ Validation error occurred'
      };
    }
  }

  /**
   * Get quality assessment message based on PSNR/SSIM
   * @param {number} psnr - PSNR value
   * @param {number} ssim - SSIM value
   * @returns {string} Quality message
   * @private
   */
  getQualityMessage(psnr, ssim) {
    try {
      let quality = '📊 Quality Metrics:\n';

      // PSNR assessment
      if (psnr !== null && psnr !== undefined) {
        if (psnr >= 40) {
          quality += `✅ PSNR: ${psnr.toFixed(2)} dB (Excellent quality)\n`;
        } else if (psnr >= 35) {
          quality += `✅ PSNR: ${psnr.toFixed(2)} dB (Good quality)\n`;
        } else if (psnr >= 30) {
          quality += `⚠️ PSNR: ${psnr.toFixed(2)} dB (Acceptable quality)\n`;
        } else {
          quality += `⚠️ PSNR: ${psnr.toFixed(2)} dB (Reduced quality)\n`;
        }
      }

      // SSIM assessment
      if (ssim !== null && ssim !== undefined) {
        const ssimPercent = (ssim * 100).toFixed(1);
        if (ssim >= 0.95) {
          quality += `✅ SSIM: ${ssimPercent}% (Near identical)`;
        } else if (ssim >= 0.90) {
          quality += `✅ SSIM: ${ssimPercent}% (Very similar)`;
        } else if (ssim >= 0.80) {
          quality += `⚠️ SSIM: ${ssimPercent}% (Similar)`;
        } else {
          quality += `⚠️ SSIM: ${ssimPercent}% (Different)`;
        }
      }

      return quality || 'Decompressed successfully';
    } catch (error) {
      console.error('MetaDataManager.getQualityMessage() error:', error);
      return 'Decompressed successfully';
    }
  }

  /**
   * Format metadata for display/logging
   * @param {Object} metadata - Metadata object
   * @returns {Object} Formatted metadata with readable values
   */
  formatMetadataForDisplay(metadata) {
    try {
      if (!metadata) {
        return null;
      }

      return {
        filename: metadata.originalFilename,
        originalSize: this.formatBytes(metadata.originalSize),
        compressedSize: this.formatBytes(metadata.compressedSize),
        compressionRatio: metadata.compressionRatio,
        spaceSaved: metadata.spaceSaved,
        algorithm: metadata.algorithm,
        timestamp: this.formatTimestamp(metadata.timestamp),
        compressionLevel: metadata.compressionLevel,
        type: metadata.isLossy ? 'Lossy' : 'Lossless',
        quality: {
          psnr: metadata.psnr ? metadata.psnr.toFixed(2) : 'N/A',
          ssim: metadata.ssim ? (metadata.ssim * 100).toFixed(1) + '%' : 'N/A'
        }
      };
    } catch (error) {
      console.error('MetaDataManager.formatMetadataForDisplay() error:', error);
      return null;
    }
  }

  /**
   * Format bytes to human-readable format
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string (e.g., "2.5 MB")
   * @private
   */
  formatBytes(bytes) {
    try {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch (error) {
      console.error('MetaDataManager.formatBytes() error:', error);
      return bytes + ' bytes';
    }
  }

  /**
   * Format ISO timestamp to readable format
   * @param {string} isoString - ISO 8601 timestamp
   * @returns {string} Formatted date and time
   * @private
   */
  formatTimestamp(isoString) {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.error('MetaDataManager.formatTimestamp() error:', error);
      return isoString;
    }
  }

  /**
   * Get current metadata
   * @returns {Object} Current metadata object
   */
  getMetadata() {
    return this.metadata;
  }

  /**
   * Clear current metadata
   */
  clearMetadata() {
    this.metadata = null;
  }

  /**
   * Validate metadata structure
   * @param {Object} metadata - Metadata to validate
   * @returns {boolean} True if valid
   */
  isValidMetadataStructure(metadata) {
    try {
      const requiredFields = [
        'version',
        'originalFilename',
        'originalSize',
        'compressedSize',
        'compressionRatio',
        'algorithm',
        'timestamp'
      ];

      if (!metadata || typeof metadata !== 'object') {
        return false;
      }

      for (const field of requiredFields) {
        if (!(field in metadata)) {
          console.warn(`Missing metadata field: ${field}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('MetaDataManager.isValidMetadataStructure() error:', error);
      return false;
    }
  }
}

// Export as default
export default MetaDataManager;