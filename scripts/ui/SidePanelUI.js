// ── Dark Mode ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const html = document.documentElement;
    const themeBtn = document.getElementById('theme-toggle');
    const saved = localStorage.getItem('ff-theme') || 'light';
    html.setAttribute('data-theme', saved);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const current = html.getAttribute('data-theme') || 'light';
            const next = current === 'light' ? 'dark' : 'light';
            html.setAttribute('data-theme', next);
            localStorage.setItem('ff-theme', next);
        });
    }

    // ── Mode Tabs ──────────────────────────────────────────────────────────────
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    // ── File Preview & Video Options ──────────────────────────────────────────
    const VIDEO_TYPES = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv'];
    const fileInput = document.getElementById('file-input');
    const previewCard = document.getElementById('file-preview-card');
    const fileTypeBadge = document.getElementById('file-type-badge');
    const fileNameEl = document.getElementById('file-name');
    const fileOrigSize = document.getElementById('file-original-size');
    const fileEstSize = document.getElementById('file-est-size');
    const videoOptions = document.getElementById('video-options');
    const dropZone = document.getElementById('drop-zone');

    const TYPE_COLORS = {
        pdf: '#e55', jpg: '#e87d2a', jpeg: '#e87d2a', png: '#2a8de8',
        mp3: '#a855f7', wav: '#a855f7', mp4: '#10b981', avi: '#10b981',
        mov: '#10b981', txt: '#6b7280', csv: '#0ea5e9', gz: '#f59e0b'
    };

    function formatBytes(bytes) {
        if (!bytes) return '—';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function showFilePreview(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        const isVideo = VIDEO_TYPES.includes(ext);

        fileTypeBadge.textContent = ext.toUpperCase();
        fileTypeBadge.style.background = (TYPE_COLORS[ext] || '#6b7280') + '22';
        fileTypeBadge.style.color = TYPE_COLORS[ext] || '#6b7280';
        fileTypeBadge.style.borderColor = (TYPE_COLORS[ext] || '#6b7280') + '44';

        fileNameEl.textContent = file.name;
        fileOrigSize.textContent = formatBytes(file.size);

        const estRatio = isVideo ? 0.35 : 0.28;
        const estBytes = Math.round(file.size * estRatio);
        fileEstSize.textContent = '~' + formatBytes(estBytes);

        previewCard.classList.remove('hidden');
        dropZone.classList.add('has-file');
        videoOptions.classList.toggle('hidden', !isVideo);
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files[0]) {
                showFilePreview(fileInput.files[0]);
            }
        });
    }

    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => { 
            e.preventDefault(); 
            e.dataTransfer.dropEffect = 'copy';
            dropZone.classList.add('drag-over'); 
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const dt = e.dataTransfer;

            if (dt && dt.files && dt.files.length > 0) {
                showFilePreview(dt.files[0]);
                const btnCompress = document.getElementById('btn-compress');
                const btnDecompress = document.getElementById('btn-decompress');
                if (btnCompress) btnCompress.disabled = false;
                if (btnDecompress) btnDecompress.disabled = false;
                return;
            }

            const url = dt.getData('text/uri-list');
            if (url && url.trim()) {
                try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const blob = await res.blob();
                    const fileName = url.split('/').pop() || 'web-file';
                    const file = new File([blob], fileName, { type: blob.type });
                    showFilePreview(file);
                    const btnCompress = document.getElementById('btn-compress');
                    const btnDecompress = document.getElementById('btn-decompress');
                    if (btnCompress) btnCompress.disabled = false;
                    if (btnDecompress) btnDecompress.disabled = false;
                } catch (err) {
                    console.error('Fetch failed:', err);
                    alert('This site blocks direct access. Try right-click → save image instead.');
                }
            }
        });
    }

    const removeFileBtn = document.getElementById('remove-file');
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', () => {
            if (fileInput) fileInput.value = '';
            previewCard.classList.add('hidden');
            dropZone.classList.remove('has-file');
            videoOptions.classList.add('hidden');
            fileNameEl.textContent = 'No file selected';
            const btnCompress = document.getElementById('btn-compress');
            const btnDecompress = document.getElementById('btn-decompress');
            if (btnCompress) btnCompress.disabled = true;
            if (btnDecompress) btnDecompress.disabled = true;
            
            // Also notify SidePanelHandler if possible, but the event listeners check fileInput.files[0] anyway
        });
    }

    // ── Video compression level pills ─────────────────────────────────────────
    const slider = document.getElementById('compression-slider');
    const pillFast = document.getElementById('pill-fast');
    const pillMax = document.getElementById('pill-max');

    window.setCompressionLevel = function(level) {
        if (pillFast) pillFast.classList.toggle('active', level === 'fast');
        if (pillMax) pillMax.classList.toggle('active', level === 'max');
        const newLevel = level === 'fast' ? 3 : 9;
        if (slider) {
            slider.value = newLevel;
            slider.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    if (pillFast) pillFast.addEventListener('click', () => window.setCompressionLevel('fast'));
    if (pillMax) pillMax.addEventListener('click', () => window.setCompressionLevel('max'));

    // ── Recent Files History ──────────────────────────────────────────────────
    const HISTORY_KEY = 'ff-history';

    function loadHistory() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
        catch { return []; }
    }

    function saveToHistory(entry) {
        const history = loadHistory();
        history.unshift(entry);
        if (history.length > 8) history.pop();
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        renderHistory();
    }

    const EXT_COLOR = {
        pdf: '#e55', png: '#2a8de8', jpg: '#e87d2a', jpeg: '#e87d2a',
        mp3: '#a855f7', wav: '#a855f7', mp4: '#10b981', avi: '#10b981',
        mov: '#10b981', txt: '#6b7280', csv: '#0ea5e9', gz: '#f59e0b'
    };

    function renderHistory() {
        const list = document.getElementById('history-list');
        const empty = document.getElementById('history-empty');
        if (!list || !empty) return;
        
        const history = loadHistory();
        const items = list.querySelectorAll('.history-item');
        items.forEach(i => i.remove());

        if (history.length === 0) {
            empty.style.display = 'flex';
            return;
        }
        empty.style.display = 'none';

        history.forEach(entry => {
            const color = EXT_COLOR[entry.ext] || '#6b7280';
            const savings = entry.savings > 0 ? `-${entry.savings}%` : `+${Math.abs(entry.savings)}%`;
            const badgeClass = entry.savings > 0 ? 'badge-green' : 'badge-amber';
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="hist-type" style="background:${color}22;color:${color};border-color:${color}44">${entry.ext.toUpperCase()}</div>
                <div class="hist-info">
                    <div class="hist-name" title="${entry.name}">${entry.name}</div>
                    <div class="hist-meta">${entry.from} → ${entry.to} &nbsp;·&nbsp; ${entry.time}</div>
                </div>
                <div class="hist-badge ${badgeClass}">${savings}</div>`;
            list.appendChild(div);
        });
    }

    window.clearHistory = function() {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
    };

    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', window.clearHistory);
    }

    // Hook into download button to save history
    const dlBtn = document.getElementById('btn-download');
    if (dlBtn) {
        dlBtn.addEventListener('click', () => {
            const nameEl = document.getElementById('file-name');
            const origVal = document.getElementById('val-original').textContent;
            const compVal = document.getElementById('val-compressed').textContent;
            const savingsVal = document.getElementById('val-savings').textContent;
            const name = nameEl ? nameEl.textContent : 'unknown';
            const ext = name.split('.').pop().toLowerCase();
            const savingsNum = parseInt(savingsVal) || 0;
            const now = new Date();
            const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
            saveToHistory({ name, ext, from: origVal, to: compVal, savings: savingsNum, time: timeStr });
        });
    }

    renderHistory();
});