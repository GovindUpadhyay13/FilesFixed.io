let keepAliveInterval = null;

chrome.runtime.onInstalled.addListener(() => {
    console.log("Files.io Extension by SMG successfully installed and background worker active.");
    
    // ===== ENABLE SIDE PANEL ON CLICK =====
    // This tells Chrome to open the side panel when the user clicks the extension icon
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error("Error setting panel behavior:", error));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'START_HEAVY_PROCESSING') {
        console.log("[Files.io Service Worker] Heavy processing started. Initiating keep-alive protocol...");
        if (!keepAliveInterval) {
            keepAliveInterval = setInterval(() => {
                chrome.runtime.getPlatformInfo(() => {});
            }, 20000);
        }
        sendResponse({ status: "Keep-alive active" });
    }
    else if (message.action === 'STOP_HEAVY_PROCESSING') {
        console.log("[Files.io Service Worker] Processing complete. Releasing keep-alive.");
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
        }
        sendResponse({ status: "Keep-alive deactivated" });
    }
    else if (message.action === 'FETCH_VIDEO') {
        fetchExternalVideo(message.url).then(sendResponse);
    }

    return true;
});

async function fetchExternalVideo(url) {
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Network error: ${response.status}`);
        }

        const videoBlob = await response.blob();

        const arrayBuffer = await videoBlob.arrayBuffer();

        let binaryString = '';
        const bytes = new Uint8Array(arrayBuffer);
        for (let i = 0; i < bytes.length; i++) {
            binaryString += String.fromCharCode(bytes[i]);
        }

        const base64Data = btoa(binaryString);

        return {
            success: true,
            dataUrl: `data:${videoBlob.type};base64,${base64Data}`
        };

    } catch (error) {
        console.error("External Fetch Error:", error);
        return { success: false, error: error.message };
    }
}