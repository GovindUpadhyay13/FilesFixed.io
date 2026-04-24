/**
 * Files.io Progress Tracker
 * Handles real-time compression/decompression progress display
 * Shows percentage, elapsed time, and estimated remaining time
 * Built by SMG
 */

export class ProgressTracker {
  constructor() {
    // DOM Elements
    this.progressContainer = document.getElementById('progress-container');
    this.progressFill = document.getElementById('progress-fill');
    this.progressPercent = document.getElementById('progress-percent');
    this.progressStatus = document.getElementById('progress-status');
    this.progressElapsed = document.getElementById('progress-elapsed');
    this.progressRemaining = document.getElementById('progress-remaining');

    // State variables
    this.startTime = null;
    this.lastUpdateTime = null;
    this.currentPercentage = 0;
    this.elapsedSeconds = 0;
    this.estimatedTotalTime = 0;
    this.estimatedRemainingTime = 0;
    this.updateInterval = null;
    this.isRunning = false;

    // Speed profiles (bytes per second) for different operations
    this.speedProfiles = {
      'text': 100 * 1024 * 1024,      // 100 MB/s
      'image-png': 50 * 1024 * 1024,  // 50 MB/s
      'image-jpg': 30 * 1024 * 1024,  // 30 MB/s
      'audio': 10 * 1024 * 1024,      // 10 MB/s
      'video-fast': 1 * 1024 * 1024,  // 1 MB/s
      'video-best': 0.5 * 1024 * 1024 // 0.5 MB/s
    };
  }

  /**
   * Start progress tracking
   * @param {number} estimatedTotalSeconds - Estimated total time in seconds
   * @param {string} operation - Type of operation (text, image-png, video-fast, etc.)
   */
  start(estimatedTotalSeconds = null, operation = 'text') {
    try {
      this.startTime = Date.now();
      this.lastUpdateTime = this.startTime;
      this.currentPercentage = 0;
      this.elapsedSeconds = 0;
      this.isRunning = true;

      // Estimate total time if not provided
      if (estimatedTotalSeconds === null) {
        this.estimatedTotalTime = this.getEstimatedTime(operation);
      } else {
        this.estimatedTotalTime = estimatedTotalSeconds;
      }

      // Show progress container
      if (this.progressContainer) {
        this.progressContainer.classList.remove('hidden');
      }

      // Initialize UI
      this.updateUI();

      // Start update interval (every 100ms)
      this.updateInterval = setInterval(() => {
        if (this.isRunning) {
          this.updateUI();
        }
      }, 100);

      console.log('Files.io: Progress tracking started');
    } catch (error) {
      console.error('ProgressTracker.start() error:', error);
    }
  }

  /**
   * Update progress with current bytes processed
   * @param {number} currentBytes - Bytes processed so far
   * @param {number} totalBytes - Total bytes to process
   */
  update(currentBytes, totalBytes) {
    try {
      if (totalBytes === 0) return;

      // Calculate percentage
      this.currentPercentage = Math.min(
        Math.floor((currentBytes / totalBytes) * 100),
        99 // Never reach 100% until complete() is called
      );

      // Calculate elapsed time (in seconds)
      const now = Date.now();
      this.elapsedSeconds = (now - this.startTime) / 1000;

      // Calculate speed and remaining time (after 1 second of progress)
      if (this.elapsedSeconds > 1) {
        const speed = currentBytes / this.elapsedSeconds; // bytes per second
        const remainingBytes = totalBytes - currentBytes;
        this.estimatedRemainingTime = remainingBytes / speed; // seconds
      } else {
        this.estimatedRemainingTime = this.estimatedTotalTime - this.elapsedSeconds;
      }

      // Update UI
      this.updateUI();
    } catch (error) {
      console.error('ProgressTracker.update() error:', error);
    }
  }

  /**
   * Update all UI elements with current progress
   * Private method
   */
  updateUI() {
    try {
      // Update percentage
      if (this.progressPercent) {
        this.progressPercent.textContent = `${this.currentPercentage}%`;
      }

      // Update progress bar fill width
      if (this.progressFill) {
        this.progressFill.style.width = `${this.currentPercentage}%`;
      }

      // Update elapsed time
      if (this.progressElapsed) {
        this.progressElapsed.textContent = this.formatTime(this.elapsedSeconds);
      }

      // Update estimated remaining time
      if (this.progressRemaining) {
        if (this.estimatedRemainingTime > 0) {
          this.progressRemaining.textContent = this.formatTime(this.estimatedRemainingTime);
        } else {
          this.progressRemaining.textContent = '--:--';
        }
      }

      // Update status text based on progress
      if (this.progressStatus) {
        this.progressStatus.textContent = this.getStatusText(this.currentPercentage);
      }
    } catch (error) {
      console.error('ProgressTracker.updateUI() error:', error);
    }
  }

  /**
   * Get status text based on progress percentage
   * @param {number} percentage - Current percentage (0-100)
   * @returns {string} Status text
   * @private
   */
  getStatusText(percentage) {
    if (percentage < 25) {
      return 'Analyzing file...';
    } else if (percentage < 50) {
      return 'Processing...';
    } else if (percentage < 75) {
      return 'Compressing...';
    } else if (percentage < 95) {
      return 'Finalizing...';
    } else {
      return 'Almost done...';
    }
  }

  /**
   * Mark operation as complete
   * Shows 100% and hides after delay
   */
  complete() {
    try {
      this.currentPercentage = 100;
      this.isRunning = false;

      // Final UI update
      if (this.progressPercent) {
        this.progressPercent.textContent = '100%';
      }

      if (this.progressFill) {
        this.progressFill.style.width = '100%';
      }

      if (this.progressStatus) {
        this.progressStatus.textContent = 'Complete!';
      }

      // Update final elapsed time
      this.elapsedSeconds = (Date.now() - this.startTime) / 1000;
      if (this.progressElapsed) {
        this.progressElapsed.textContent = this.formatTime(this.elapsedSeconds);
      }

      // Clear remaining time
      if (this.progressRemaining) {
        this.progressRemaining.textContent = this.formatTime(0);
      }

      console.log('Files.io: Compression complete');

      // Auto-hide after 1 second
      setTimeout(() => {
        this.end();
      }, 1000);
    } catch (error) {
      console.error('ProgressTracker.complete() error:', error);
    }
  }

  /**
   * End progress tracking and hide progress container
   * Cleanup
   */
  end() {
    try {
      // Clear interval
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }

      // Hide progress container
      if (this.progressContainer) {
        this.progressContainer.classList.add('hidden');
      }

      // Reset state
      this.isRunning = false;
      this.currentPercentage = 0;
      this.elapsedSeconds = 0;
      this.estimatedTotalTime = 0;
      this.estimatedRemainingTime = 0;
      this.startTime = null;

      console.log('Files.io: Progress tracker ended and cleaned up');
    } catch (error) {
      console.error('ProgressTracker.end() error:', error);
    }
  }

  /**
   * Format seconds to MM:SS or H:MM:SS format
   * @param {number} seconds - Total seconds
   * @returns {string} Formatted time string
   * @private
   */
  formatTime(seconds) {
    try {
      // Handle negative or invalid values
      if (seconds < 0 || !isFinite(seconds)) {
        return '0:00';
      }

      const totalSeconds = Math.floor(seconds);

      // Hours
      const hours = Math.floor(totalSeconds / 3600);
      
      // Minutes
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      
      // Seconds
      const secs = totalSeconds % 60;

      // Format based on duration
      if (hours > 0) {
        // H:MM:SS format
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      } else {
        // MM:SS format
        return `${minutes}:${String(secs).padStart(2, '0')}`;
      }
    } catch (error) {
      console.error('ProgressTracker.formatTime() error:', error);
      return '0:00';
    }
  }

  /**
   * Estimate total time based on file type and operation
   * @param {string} operation - Type of operation
   * @returns {number} Estimated time in seconds
   * @private
   */
  getEstimatedTime(operation) {
    try {
      // Default estimates based on operation type
      const estimates = {
        'text': 1,           // 1 second
        'image-png': 2,      // 2 seconds
        'image-jpg': 3,      // 3 seconds
        'audio': 10,         // 10 seconds
        'video-fast': 30,    // 30 seconds
        'video-best': 120    // 2 minutes
      };

      return estimates[operation] || 10; // Default 10 seconds
    } catch (error) {
      console.error('ProgressTracker.getEstimatedTime() error:', error);
      return 10;
    }
  }

  /**
   * Calculate estimated total time for file operation
   * @param {number} fileSize - Size of file in bytes
   * @param {string} operationType - Type of operation
   * @returns {number} Estimated time in seconds
   */
  estimateTimeForOperation(fileSize, operationType) {
    try {
      const speed = this.speedProfiles[operationType] || this.speedProfiles['text'];
      const estimatedSeconds = fileSize / speed;
      
      // Ensure minimum estimate
      return Math.max(estimatedSeconds, 1);
    } catch (error) {
      console.error('ProgressTracker.estimateTimeForOperation() error:', error);
      return 10;
    }
  }

  /**
   * Check if progress tracking is currently running
   * @returns {boolean} True if running
   */
  isActive() {
    return this.isRunning;
  }

  /**
   * Get current progress percentage
   * @returns {number} Current percentage (0-100)
   */
  getProgress() {
    return this.currentPercentage;
  }

  /**
   * Get elapsed time in seconds
   * @returns {number} Elapsed seconds
   */
  getElapsedTime() {
    return this.elapsedSeconds;
  }

  /**
   * Get estimated remaining time in seconds
   * @returns {number} Remaining seconds
   */
  getRemainingTime() {
    return this.estimatedRemainingTime;
  }
}

// Export as default
export default ProgressTracker;