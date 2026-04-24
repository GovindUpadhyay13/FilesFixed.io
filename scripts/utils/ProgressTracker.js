/**
 * Files.io Progress Tracker Module
 * Handles real-time progress display for compression operations
 */
export class ProgressTracker {
    constructor() {
        this.startTime = null;
        this.lastUpdateTime = null;
        this.estimatedTotalTime = null;
        this.currentPercentage = 0;
        this.elapsedSeconds = 0;
        this.updateInterval = null;
        
        // DOM Elements
        this.progressContainer = document.getElementById('progress-container');
        this.progressFill = document.getElementById('progress-fill');
        this.progressPercent = document.getElementById('progress-percent');
        this.progressStatus = document.getElementById('progress-status');
        this.progressElapsed = document.getElementById('progress-elapsed');
        this.progressRemaining = document.getElementById('progress-remaining');
    }

    start() {
        if (!this.progressContainer) return;
        
        this.startTime = Date.now();
        this.currentPercentage = 0;
        this.elapsedSeconds = 0;
        
        this.progressContainer.classList.remove('hidden');
        if (this.progressStatus) this.progressStatus.textContent = "Processing...";
        if (this.progressFill) this.progressFill.style.width = "0%";
        if (this.progressPercent) this.progressPercent.textContent = "0%";
        if (this.progressElapsed) this.progressElapsed.textContent = "0:00";
        if (this.progressRemaining) this.progressRemaining.textContent = "--:--";

        this.updateInterval = setInterval(() => this.updateUI(), 100);
    }

    update(currentBytes, totalBytes) {
        if (totalBytes === 0) return;
        
        const percentage = (currentBytes / totalBytes) * 100;
        this.currentPercentage = Math.min(100, Math.max(0, Math.floor(percentage)));
        
        if (this.startTime) {
            this.elapsedSeconds = (Date.now() - this.startTime) / 1000;
            
            if (this.currentPercentage > 0 && this.elapsedSeconds > 1) {
                const speed = currentBytes / this.elapsedSeconds;
                const remainingBytes = totalBytes - currentBytes;
                this.estimatedTotalTime = this.elapsedSeconds + (remainingBytes / speed);
            }
        }
    }

    updateUI() {
        if (!this.progressContainer) return;

        if (this.startTime) {
            this.elapsedSeconds = (Date.now() - this.startTime) / 1000;
        }

        if (this.progressPercent) this.progressPercent.textContent = `${this.currentPercentage}%`;
        if (this.progressFill) this.progressFill.style.width = `${this.currentPercentage}%`;
        if (this.progressElapsed) this.progressElapsed.textContent = this.formatTime(this.elapsedSeconds);

        if (this.estimatedTotalTime && this.currentPercentage > 0) {
            const remaining = Math.max(0, this.estimatedTotalTime - this.elapsedSeconds);
            if (this.progressRemaining) this.progressRemaining.textContent = this.formatTime(remaining);
        }

        if (this.progressStatus) {
            if (this.currentPercentage < 25) this.progressStatus.textContent = "Analyzing file...";
            else if (this.currentPercentage < 50) this.progressStatus.textContent = "Compressing...";
            else if (this.currentPercentage < 75) this.progressStatus.textContent = "Finalizing...";
            else if (this.currentPercentage < 100) this.progressStatus.textContent = "Almost done...";
            else this.progressStatus.textContent = "Complete!";
        }
    }

    complete() {
        this.currentPercentage = 100;
        if (this.progressFill) this.progressFill.style.width = "100%";
        if (this.progressStatus) this.progressStatus.textContent = "Complete!";
        if (this.progressPercent) this.progressPercent.textContent = "100%";
        
        if (this.startTime) {
            this.elapsedSeconds = (Date.now() - this.startTime) / 1000;
            if (this.progressElapsed) this.progressElapsed.textContent = this.formatTime(this.elapsedSeconds);
        }
        
        if (this.progressRemaining) this.progressRemaining.textContent = "0:00";

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        setTimeout(() => this.end(), 1000);
    }

    end() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.progressContainer) {
            this.progressContainer.classList.add('hidden');
        }
        
        this.startTime = null;
        this.estimatedTotalTime = null;
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
        
        const totalSeconds = Math.floor(seconds);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        
        const paddedS = s.toString().padStart(2, '0');
        
        if (h > 0) {
            const paddedM = m.toString().padStart(2, '0');
            return `${h}:${paddedM}:${paddedS}`;
        }
        return `${m}:${paddedS}`;
    }

    estimateTimeForOperation(fileSize, compressionType) {
        let speed = 10 * 1024 * 1024; // Default medium 10MB/s
        
        if (compressionType.startsWith('text') || compressionType === 'application/pdf') speed = 100 * 1024 * 1024;
        else if (compressionType === 'image/png') speed = 50 * 1024 * 1024;
        else if (compressionType === 'image/jpeg') speed = 30 * 1024 * 1024;
        else if (compressionType.startsWith('audio')) speed = 10 * 1024 * 1024;
        else if (compressionType.startsWith('video')) speed = 1 * 1024 * 1024; // rough estimate
        
        return fileSize / speed;
    }
}