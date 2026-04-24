import { compressAudio } from '../compressors/lossy/audio-mp3.js';
import { compressText, decompressText } from '../compressors/lossless/text-gz.js';
import { compressLosslessPNG } from '../compressors/lossless/image-png.js';
import { compressJPG, decompressJPG } from '../compressors/lossy/image-jpg.js';
import { compressMP4, decompressMP4 } from '../compressors/lossy/video-mp4.js';
import { FileProcessor } from '../utils/file-reader.js';
import { MetaDataManager } from '../utils/MetaData_manager.js';
import { ProgressTracker } from '../utils/ProgressTracker.js';


document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    
    // ✅ CRITICAL: Exit early if drop zone doesn't exist
    if (!dropZone) {
      console.error('Drop zone element not found');
      return;
    }
    
    const fileInput = document.getElementById('file-input');
    const fileNameDisplay = document.getElementById('file-name');
    const btnCompress = document.getElementById('btn-compress');
    const btnDecompress = document.getElementById('btn-decompress');
    const errorMessage = document.getElementById('error-message');
    const resultsDashboard = document.getElementById('results-dashboard');
    const btnDownload = document.getElementById('btn-download');
    const verificationStatus = document.getElementById('verification-status');

  // ===== SETTINGS VARIABLES =====
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsPanel = document.getElementById('settings-panel');
  const closeSettings = document.getElementById('close-settings');
  const autoDeleteToggle = document.getElementById('auto-delete-toggle');
  const verifyHashToggle = document.getElementById('verify-hash-toggle');

  // ===== COMPRESSION LEVEL VARIABLES =====
  const compressionSlider = document.getElementById('compression-slider');
  const compressionLabel = document.getElementById('compression-label');
  let selectedCompressionLevel = '5'; // Default: Balanced

    let currentFile = null;
    let processedBlob = null;
    let lastOriginalHash = null;

  // ===== COMPRESSION SLIDER EVENT LISTENERS =====
  if (compressionSlider) {
    compressionSlider.addEventListener('input', (e) => {
      selectedCompressionLevel = e.target.value;
      updateCompressionLabel(selectedCompressionLevel);
    });
  }

  // ===== SETTINGS EVENT LISTENERS =====
  if (settingsToggle && settingsPanel && closeSettings) {
      settingsToggle.addEventListener('click', () => {
          if (settingsPanel) settingsPanel.classList.remove('hidden');
      });
      closeSettings.addEventListener('click', () => {
          if (settingsPanel) settingsPanel.classList.add('hidden');
      });
  }

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.dataTransfer.dropEffect = 'copy';
          dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    // ✅ FIXED: Handle both local files AND URLs with CORS safety
    dropZone.addEventListener('drop', async (e) => {
        const dt = e.dataTransfer;

        // Case 1: Local file
        if (dt.files && dt.files.length > 0) {
            handleFileSelect(dt.files[0]);
            enableButtons();
            return;
        }

        // Case 2: From website (URL)
        const url = dt.getData('text/uri-list');
        if (url && url.trim()) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const fileName = url.split('/').pop() || 'web-file';
                const file = new File([blob], fileName, { type: blob.type });
                handleFileSelect(file);
                enableButtons();
            } catch (err) {
                console.error('Fetch failed (CORS likely):', err);
                showError('This site blocks direct access. Try right-click → save image instead.');
            }
        }
    });

    // ===== CLICK TO UPLOAD =====
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
            enableButtons();
        }
    });

    // ===== ENABLE BUTTONS HELPER =====
    function enableButtons() {
        if (btnCompress) btnCompress.disabled = false;
        if (btnDecompress) btnDecompress.disabled = false;
    }

    function handleFileSelect(file) {
        hideError();
        resultsDashboard.classList.add('hidden');
        if (verificationStatus) verificationStatus.classList.add('hidden');

        if (!file) return;

        const fileName = (file.name || '').toLowerCase();
        console.log('📁 File selected:', file.name);

        const allowedTypes = [
            'text/plain', 'text/csv', 'image/jpeg', 'image/png',
            'audio/mpeg', 'audio/wav', 'video/mp4', 'application/gzip', 'application/x-gzip',
            'application/pdf'
        ];

        const allowedExtensions = ['txt', 'csv', 'jpg', 'jpeg', 'png', 'mp3', 'wav', 'mp4', 'pdf', 'gz'];
        const hasSupportedExtension = allowedExtensions.some(ext => fileName.endsWith(`.${ext}`));
        const hasSupportedType = allowedTypes.includes(file.type);

        if (!hasSupportedType && !hasSupportedExtension) {
            showError("Unsupported format. Please upload TXT, CSV, JPG, PNG, MP3, WAV, MP4, PDF, or GZ.");
            if (btnCompress) btnCompress.disabled = true;
            if (btnDecompress) btnDecompress.disabled = true;
            console.warn('⚠ Unsupported file type:', file.type);
            return;
        }

        currentFile = file;
        if (fileNameDisplay) fileNameDisplay.textContent = currentFile.name;

        if (btnCompress) btnCompress.disabled = false;
        if (btnDecompress) btnDecompress.disabled = false;

  // ===== SHOW/HIDE SLIDER BASED ON FILE TYPE =====
  const isVideo = fileName.endsWith('.mp4') || file.type === 'video/mp4';
  console.log('Video file?', isVideo);
  if (isVideo) {
    showCompressionSlider();
  } else {
    hideCompressionSlider();
  }
    }

    btnCompress.addEventListener('click', async () => {
        if (!currentFile) {
            showError('No file selected. Please select a file first.');
            return;
        }

        btnCompress.disabled = true;
        btnCompress.textContent = "Compressing...";

        console.log('🔄 Compression started for:', currentFile.name);
        console.log('   File type:', currentFile.type);
        console.log('   File size:', currentFile.size, 'bytes');
        console.log('   Compression level:', selectedCompressionLevel);

        // ===== START PROGRESS TRACKER =====
        const tracker = new ProgressTracker();
        tracker.start();
        
        let result;
        try {
            hideError();
            const fileType = currentFile.type;

  // ===== PREPARE COMPRESSION OPTIONS =====
  let compressionOptions = {
    level: selectedCompressionLevel,
    onProgress: (progressData) => {
      // Pass actual bytes if available, otherwise pass percentage logic
      if (progressData.current !== undefined && progressData.total !== undefined) {
         tracker.update(progressData.current, progressData.total);
      } else if (progressData.ratio !== undefined) {
         const estimatedTotal = currentFile.size;
         tracker.update(estimatedTotal * progressData.ratio, estimatedTotal);
      }
    }
  };
  
  console.log('   Options:', compressionOptions);

            // Simulation interval to provide visual feedback if actual compressor doesn't report progress
            let simulatedProgress = 0;
            const timer = setInterval(() => {
                if (simulatedProgress < 90) {
                    simulatedProgress += 5;
                    tracker.update(simulatedProgress, 100);
                }
            }, 300);

            if (fileType.startsWith('audio/')) {
                console.log('→ Compressing audio file');
                result = await compressAudio(currentFile);
            }
            else if (fileType === 'image/png') {
                console.log('→ Compressing PNG image (lossless)');
                result = await compressLosslessPNG(currentFile);
            }
            else if (fileType === 'image/jpeg' || fileType === 'image/jpg') {
                console.log('→ Compressing JPG image');
                result = await compressJPG(currentFile);
            }
            else if (fileType === 'video/mp4') {
                console.log('→ Compressing MP4 video with level:', compressionOptions.level);
                result = await compressMP4(currentFile, compressionOptions);
            }
            else if (fileType.startsWith('text/') || currentFile.name.endsWith('.csv') || fileType === 'application/pdf') {
                console.log('→ Compressing text/document file');
                result = await compressText(currentFile);
                lastOriginalHash = result.originalHash;
                showVerification('compress', result.originalHash);
            }
            else {
                throw new Error("Cannot compress this file type: " + fileType);
            }
            
            if (!result || !result.blob) {
                throw new Error('Compression returned invalid result');
            }
            
            console.log('✓ Compression complete:', { blobSize: result.blob.size, metrics: result.metrics });
            processedBlob = result.blob;

            // ===== EMBED METADATA IF ENABLED =====
            if (verifyHashToggle && verifyHashToggle.checked) {
                console.log('→ Generating and embedding metadata...');
                const metadata = await MetaDataManager.generateMetadata(
                    currentFile, 
                    processedBlob, 
                    result.metrics, 
                    { 
                        algorithm: fileType, 
                        isLossy: !fileType.startsWith('text/'),
                        psnr: result.psnr 
                    }
                );
                processedBlob = await MetaDataManager.embedMetadata(processedBlob, metadata);
                console.log('✓ Metadata embedded successfully');
            }

            clearInterval(timer);
            tracker.update(100, 100);
            tracker.complete();

            let downloadName;
            if (fileType.startsWith('text/') || currentFile.name.endsWith('.csv') || fileType === 'application/pdf') {
                const baseName = currentFile.name.split('.')[0];
                downloadName = `${baseName}.${currentFile.name.split('.').pop()}.gz`;
            } else {
                downloadName = currentFile.name;
            }

            currentFile = new File([processedBlob], downloadName, {
                type: processedBlob.type || currentFile.type,
                lastModified: Date.now()
            });

            updateDashboard(result.metrics, result.psnr, 'compress');

            setupDownload(processedBlob, downloadName.startsWith('compressed_') ? downloadName : `compressed_${downloadName}`);

        } catch (error) {
            console.error('❌ Compression error:', error);
            console.error('Error stack:', error.stack);
            showError(`Compression failed: ${error.message}`);
            // Ensure tracker resources are cleaned up
            if (typeof timer !== 'undefined') clearInterval(timer);
            tracker.end();
            return; // Prevent further execution that might hit finally
        } finally {
            if (typeof timer !== 'undefined') clearInterval(timer);
            // Just in case it wasn't completed via success path
            tracker.end(); 
            btnCompress.disabled = false;
            btnCompress.textContent = "Compress File";
        }
    });

    btnDecompress.addEventListener('click', async () => {
        if (!currentFile) {
            showError('No file selected. Please select a file first.');
            return;
        }

        btnDecompress.disabled = true;
        btnDecompress.textContent = "Decompressing...";

        // ===== START PROGRESS TRACKER =====
        const tracker = new ProgressTracker();
        tracker.start();

        try {
            hideError();
            console.log('🔄 Decompression started for:', currentFile.name);
            
            // Simulation interval to provide visual feedback if actual compressor doesn't report progress
            let simulatedProgress = 0;
            const timer = setInterval(() => {
                if (simulatedProgress < 90) {
                    simulatedProgress += 5;
                    tracker.update(simulatedProgress, 100);
                }
            }, 300);

            // ===== EXTRACT METADATA =====
            const { metadata, compressedData } = await MetaDataManager.extractMetadata(currentFile);
            const workingFile = new File([compressedData], currentFile.name, { type: currentFile.type, lastModified: Date.now() });

            let result;
            const fileName = workingFile.name || '';
            const normalizedName = fileName.toLowerCase();
            let fileType = workingFile.type;
            
            // Better file type detection from filename
            if (!fileType || fileType === 'application/octet-stream') {
                if (normalizedName.endsWith('.gz')) fileType = 'application/gzip';
                else if (normalizedName.endsWith('.jpg') || normalizedName.endsWith('.jpeg')) fileType = 'image/jpeg';
                else if (normalizedName.endsWith('.mp4')) fileType = 'video/mp4';
                else if (normalizedName.endsWith('.txt')) fileType = 'text/plain';
                else if (normalizedName.endsWith('.csv')) fileType = 'text/csv';
            }
            
            console.log('File info:', { fileName, normalizedName, detectedType: fileType });

            if (normalizedName.endsWith('.gz') || fileType === 'application/gzip' || fileType === 'application/x-gzip') {
                console.log('→ Decompressing as GZ/Text file');
                result = await decompressText(workingFile, lastOriginalHash);
                if (result && result.verification) {
                    showVerification('decompress', null, result.verification);
                }
            }
            else if (fileType === 'image/jpeg' || fileType === 'image/jpg' || normalizedName.endsWith('.jpg') || normalizedName.endsWith('.jpeg')) {
                console.log('→ Decompressing as JPG image');
                result = await decompressJPG(workingFile);
            }
            else if (fileType === 'video/mp4' || normalizedName.endsWith('.mp4')) {
                console.log('→ Decompressing as MP4 video');
                result = await decompressMP4(workingFile);
            }
            else {
                console.log('→ Using generic decompression route for type:', fileType);
                const readerRes = await FileProcessor.routeDecompression(workingFile);
                if (!readerRes) throw new Error('No decompression method available for this file type: ' + fileType);
                result = {
                    blob: new Blob([readerRes.data], { type: readerRes.type || workingFile.type || 'application/octet-stream' }),
                    metrics: { originalSize: '--', compressedSize: '--', ratio: 'N/A', savings: 'N/A' }
                };
            }

            if (!result || !result.blob) {
                throw new Error('Decompression returned invalid result');
            }

            processedBlob = result.blob;
            console.log('✓ Decompression successful, blob size:', processedBlob.size);

            // ===== METADATA VALIDATION =====
            if (metadata) {
                const decompressedArrayBuffer = await processedBlob.arrayBuffer();
                const validation = await MetaDataManager.validateMetadata(metadata, decompressedArrayBuffer);
                if (validation.psnr) result.psnr = validation.psnr;
                result.verification = validation;
            }

            clearInterval(timer);
            tracker.update(100, 100);
            tracker.complete();

            if (result.metrics) {
                updateDashboard(result.metrics, result.psnr, 'decompress');
            }

            let downloadName = normalizedName.endsWith('.gz')
                ? fileName.slice(0, -3)
                : `decompressed_${fileName}`;

            if (!normalizedName.endsWith('.gz') && fileName.startsWith('compressed_')) {
                downloadName = fileName.slice('compressed_'.length);
            }
            setupDownload(processedBlob, downloadName);

        } catch (error) {
            console.error('❌ Decompression error:', error);
            console.error('Error stack:', error.stack);
            showError(`Decompression failed: ${error.message}`);
            if (typeof timer !== 'undefined') clearInterval(timer);
            tracker.end();
            return;
        } finally {
            if (typeof timer !== 'undefined') clearInterval(timer);
            tracker.end();
            btnDecompress.disabled = false;
            btnDecompress.textContent = "Decompress File";
        }
    });

    function updateDashboard(metrics, psnr = null, mode = 'compress') {
        const isDecompress = mode === 'decompress';
        
        const labelCompressed = document.getElementById('ui-label-compressed');
        const labelSavings = document.getElementById('ui-label-savings');
        
        if (labelCompressed) labelCompressed.textContent = isDecompress ? 'Decompressed' : 'Compressed';
        if (labelSavings) labelSavings.textContent = isDecompress ? 'Upscaled By' : 'Savings';

        document.getElementById('val-original').textContent = metrics.originalSize;
        document.getElementById('val-compressed').textContent = metrics.compressedSize;
        document.getElementById('val-ratio').textContent = metrics.ratio;
        
        let finalSavings = metrics.savings;
        if (isDecompress && finalSavings.startsWith('-')) {
            finalSavings = finalSavings.substring(1); 
        }
        document.getElementById('val-savings').textContent = finalSavings; 

        if (psnr !== null && psnr !== undefined) {
            verificationStatus.innerHTML = `
                <strong>Quality Assessment</strong><br>
                <small style="color:#2ecc71;">PSNR: ${psnr} dB</small>
            `;
            verificationStatus.style.borderColor = 'rgba(46, 204, 113, 0.4)';
            verificationStatus.classList.remove('hidden');
        }

        resultsDashboard.classList.remove('hidden');
        btnDownload.classList.remove('hidden');

  // Hide progress bar
  const progressContainer = document.getElementById('progress-container');
  if (progressContainer) {
    progressContainer.classList.add('hidden');
  }
    }

    function setupDownload(blob, filename) {
        btnDownload.onclick = () => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);

            if (autoDeleteToggle && autoDeleteToggle.checked) {
                setTimeout(() => {
                    currentFile = null;
                    processedBlob = null;
                    const fileNameDisplay = document.getElementById('file-name');
                    if (fileNameDisplay) fileNameDisplay.textContent = "No file selected";
                    const btnCompress = document.getElementById('btn-compress');
                    const btnDecompress = document.getElementById('btn-decompress');
                    if (btnCompress) btnCompress.disabled = true;
                    if (btnDecompress) btnDecompress.disabled = true;
                    const resultsDashboard = document.getElementById('results-dashboard');
                    if (resultsDashboard) resultsDashboard.classList.add('hidden');
                    const btnDownload = document.getElementById('btn-download');
                    if (btnDownload) btnDownload.classList.add('hidden');
                    const verificationStatus = document.getElementById('verification-status');
                    if (verificationStatus) verificationStatus.classList.add('hidden');
                }, 500);
            }
        };
    }

    function showError(msg) {
        if (errorMessage) {
            const alertText = errorMessage.querySelector('.alert-text');
            if (alertText) {
                alertText.textContent = msg;
            } else {
                errorMessage.textContent = msg;
            }
            errorMessage.classList.remove('hidden');
            console.error('Error:', msg);
        }
    }

    function hideError() {
        if (errorMessage) {
            errorMessage.classList.add('hidden');
        }
    }

    function showVerification(mode, hash, verification) {
        verificationStatus.classList.remove('hidden');

        if (mode === 'compress' && hash) {
            verificationStatus.innerHTML = `
                <strong>SHA-256 Fingerprint</strong><br>
                <code style="font-size:10px;word-break:break-all;color:#8a2be2;">${hash}</code>
                <br><small style="color:#888;">This hash will verify lossless rebuild on decompression.</small>
            `;
            verificationStatus.style.borderColor = 'rgba(138, 43, 226, 0.4)';
        } else if (mode === 'decompress' && verification) {
            if (verification.match === true) {
                verificationStatus.innerHTML = `
                    <strong>Lossless Rebuild Verified</strong><br>
                    <small style="color:#2ecc71;">SHA-256 hashes match — byte-for-byte identical reconstruction.</small><br>
                    <code style="font-size:10px;word-break:break-all;color:#2ecc71;">${verification.computed}</code>
                `;
                verificationStatus.style.borderColor = 'rgba(46, 204, 113, 0.4)';
            } else if (verification.match === false) {
                verificationStatus.innerHTML = `
                    <strong>Hash Mismatch</strong><br>
                    <small style="color:#e74c3c;">Data may have been altered.</small><br>
                    <strong>Expected:</strong> <code style="font-size:10px;word-break:break-all;">${verification.expected}</code><br>
                    <strong>Got:</strong> <code style="font-size:10px;word-break:break-all;">${verification.computed}</code>
                `;
                verificationStatus.style.borderColor = 'rgba(231, 76, 60, 0.4)';
            } else {
                verificationStatus.innerHTML = `
                    <strong>Decompressed Successfully</strong><br>
                    <small style="color:#888;">No original hash available for comparison.</small><br>
                    <code style="font-size:10px;word-break:break-all;color:#8a2be2;">${verification.computed}</code>
                `;
                verificationStatus.style.borderColor = 'rgba(138, 43, 226, 0.4)';
            }
        }
    }

  // ===== COMPRESSION SLIDER HELPER FUNCTIONS =====
  function updateCompressionLabel(level) {
    const labels = {
      '1': 'Ultra Fast (1/10)',
      '2': 'Very Fast (2/10)',
      '3': 'Fast (3/10)',
      '4': 'Faster (4/10)',
      '5': 'Balanced (5/10)',
      '6': 'Better (6/10)',
      '7': 'Slower (7/10)',
      '8': 'Slower Still (8/10)',
      '9': 'Very Slow (9/10)',
      '10': 'Best Quality (10/10)'
    };
    
    if (compressionLabel) {
      compressionLabel.textContent = labels[level] || `Level ${level}/10`;
    }
  }

  function showCompressionSlider() {
    if (compressionSlider) {
      compressionSlider.style.display = 'block';
      const videoOptionsLabel = document.querySelector('.video-options-label');
      if (videoOptionsLabel) {
        videoOptionsLabel.parentElement.style.display = 'block';
      }
      // Also show the level pills container
      const levelPills = document.querySelector('.level-pills');
      if (levelPills) {
        levelPills.parentElement.style.display = 'block';
      }
    }
  }

  function hideCompressionSlider() {
    if (compressionSlider) {
      compressionSlider.style.display = 'none';
      const videoOptionsLabel = document.querySelector('.video-options-label');
      if (videoOptionsLabel) {
        videoOptionsLabel.parentElement.style.display = 'none';
      }
      // Also hide the level pills container
      const levelPills = document.querySelector('.level-pills');
      if (levelPills) {
        levelPills.parentElement.style.display = 'none';
      }
    }
  }
});