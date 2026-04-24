export async function compressPDF(file) {
    return new Promise(async (resolve, reject) => {
        try {
            const arrayBuffer = await file.arrayBuffer();

            const pdfDoc = await window.PDFLib.PDFDocument.load(arrayBuffer);

            pdfDoc.setTitle('');
            pdfDoc.setAuthor('');
            pdfDoc.setSubject('');
            pdfDoc.setKeywords([]);
            pdfDoc.setProducer('');
            pdfDoc.setCreator('');

            const form = pdfDoc.getForm();
            try {
                form.flatten();
            } catch (e) {
                console.warn("Could not flatten PDF forms", e);
            }

            const pdfBytes = await pdfDoc.save();

            const blob = new Blob([pdfBytes], { type: 'application/pdf' });

            const originalBytes = file.size;
            const compressedBytes = blob.size;
            const ratio = (compressedBytes > 0) ? (originalBytes / compressedBytes).toFixed(2) : "0.00";
            const savings = (originalBytes > 0) ? (((originalBytes - compressedBytes) / originalBytes) * 100).toFixed(1) : "0.0";

            resolve({
                blob: blob,
                metrics: {
                    originalSize: formatBytes(originalBytes),
                    compressedSize: formatBytes(compressedBytes),
                    ratio: `${ratio}:1`,
                    savings: savings
                }
            });

        } catch (error) {
            console.error("PDF compression error:", error);
            reject(new Error("Failed to optimize PDF."));
        }
    });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
