/**
 * download-helper.js
 * Centralized logic for file downloads and rich client-side document previews.
 * Converts DOCX, XLSX, XLS, PPTX, PDF, CSV, and text files directly to HTML in the browser.
 */

// Keep track of active blob URLs, renderers, zoom controllers, and caches
let activePreviewBlobUrl = null;
let activePptxRenderer = null;
let activeKeydownHandler = null;
let currentPreviewZoom = 1.0;
let defaultFitZoom = 1.0;
let activeZoomTarget = null;
let activeZoomSizer = null;
let activeScrollContainer = null;
let activeTouchListeners = null;
let activeDocScrollHandler = null;
let activeDocKeyHandler = null;
let activeResizeHandler = null;
const previewCache = new Map();
const loadedVendorScripts = new Map();

/**
 * Dynamically load external/vendor scripts on demand
 * Checks local /vendor/ first with fallback to trusted CDN
 */
function loadVendorScript(src, globalCheck, fallbackSrc) {
    if (globalCheck && typeof window[globalCheck] !== 'undefined') {
        return Promise.resolve(window[globalCheck]);
    }
    if (loadedVendorScripts.has(src)) {
        return loadedVendorScripts.get(src);
    }
    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            if (globalCheck && typeof window[globalCheck] === 'undefined') {
                if (fallbackSrc) {
                    loadFallback(fallbackSrc, globalCheck, resolve, reject);
                } else {
                    reject(new Error(`Library ${globalCheck} not found in ${src}`));
                }
            } else {
                resolve(globalCheck ? window[globalCheck] : true);
            }
        };
        script.onerror = () => {
            if (fallbackSrc) {
                console.warn(`Failed loading ${src}, attempting fallback ${fallbackSrc}...`);
                loadFallback(fallbackSrc, globalCheck, resolve, reject);
            } else {
                reject(new Error(`Could not load script ${src}`));
            }
        };
        document.head.appendChild(script);
    });

    function loadFallback(fbSrc, gCheck, res, rej) {
        const fbScript = document.createElement('script');
        fbScript.src = fbSrc;
        fbScript.async = true;
        fbScript.onload = () => {
            if (gCheck && typeof window[gCheck] === 'undefined') {
                rej(new Error(`Library ${gCheck} not found in fallback ${fbSrc}`));
            } else {
                res(gCheck ? window[gCheck] : true);
            }
        };
        fbScript.onerror = () => rej(new Error(`Fallback failed: ${fbSrc}`));
        document.head.appendChild(fbScript);
    }

    loadedVendorScripts.set(src, promise);
    return promise;
}

/**
 * Dynamically load PPTX renderer module
 */
async function loadPptxRenderer() {
    try {
        const mod = await import('/vendor/pptx-browser.js');
        return mod.PptxRenderer || mod.default;
    } catch (err) {
        console.warn('Local pptx-browser failed, trying CDN...', err);
        const mod = await import('https://cdn.jsdelivr.net/npm/pptx-browser/+esm');
        return mod.PptxRenderer || mod.default;
    }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Trigger a file download without opening a new tab
 * Uses Blob approach to keep user inside standalone apps when possible
 */
async function triggerDownload(url, filename, btn) {
    if (btn && btn.classList.contains('disabled')) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    
    const originalContent = btn ? btn.innerHTML : null;

    if (btn) {
        btn.classList.add('disabled');
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>...';
    }

    try {
        // --- STRATEGY 1: Native Share Sheet for iOS PWAs ---
        if (isIOS && isStandalone && navigator.canShare) {
            const response = await fetch(url, { credentials: 'same-origin' });
            if (!response.ok) throw new Error('Download mislukt');
            
            const blob = await response.blob();
            const file = new File([blob], filename || 'bestand', { type: blob.type });

            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: filename || 'Download'
                });
                return;
            }
        }

        // --- STRATEGY 2: Standard Fetch & Blob (Android, Desktop, non-PWA) ---
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) {
            if (response.status === 404) throw new Error('Bestand niet gevonden op de server.');
            throw new Error('Download mislukt (Server Error: ' + response.status + ')');
        }

        // Check file size - if > 50MB, or if Content-Length is missing, bypass blob
        const contentLength = response.headers.get('Content-Length');
        if (!contentLength || parseInt(contentLength) > 50 * 1024 * 1024) {
             if (isStandalone) {
                 window.open(url, '_blank');
             } else {
                 window.location.href = url;
             }
             return;
        }
        
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = filename || 'bestand';
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            if (a.parentNode) {
                document.body.removeChild(a);
            }
            window.URL.revokeObjectURL(blobUrl);
        }, 1000);

    } catch (e) {
        console.error('Download error:', e);
        if (isStandalone) {
            window.open(url, '_blank');
        } else {
            window.location.href = url;
        }
    } finally {
        if (btn && originalContent) {
            btn.classList.remove('disabled');
            btn.innerHTML = originalContent;
        }
    }
}

/**
 * Open a file in the shared preview modal
 */
async function openFilePreview(url, name) {
    const modalEl = document.getElementById('filePreviewModal');
    if (!modalEl) {
        console.warn('filePreviewModal not found, navigating to download endpoint:', url);
        const downloadUrl = `/download?path=${encodeURIComponent(url)}&name=${encodeURIComponent(name || 'bestand')}`;
        window.location.href = downloadUrl;
        return false;
    }

    // Cleanup previous preview state safely
    cleanupActivePreview();

    // Unwrap if passed a /download?path=... URL directly
    if (typeof url === 'string' && url.includes('/download?')) {
        try {
            const parsed = new URL(url, window.location.origin);
            const qPath = parsed.searchParams.get('path');
            const qName = parsed.searchParams.get('name');
            if (qPath) url = qPath;
            if (qName && (!name || name === 'Bestand')) name = qName;
        } catch (e) {
            // URL parse fallback
        }
    }

    if (typeof url === 'string' && url.startsWith('/uploads/feed/')) {
        url = url.replace('/uploads/feed/', '/feed_uploads/');
    }

    // Determine extension robustly from name OR url
    let ext = '';
    if (name && typeof name === 'string' && name.includes('.')) {
        ext = name.split('.').pop().toLowerCase().trim();
    }
    if (!ext && typeof url === 'string') {
        const cleanUrl = url.split('?')[0].split('#')[0];
        if (cleanUrl.includes('.')) {
            ext = cleanUrl.split('.').pop().toLowerCase().trim();
        }
    }

    const modal = new bootstrap.Modal(modalEl);
    const frame = document.getElementById('previewFrame');
    const imgContainer = document.getElementById('previewImageContainer');
    const img = document.getElementById('previewImage');
    const docContainer = document.getElementById('previewDocContainer');
    const title = document.getElementById('previewFileName');
    const fileIcon = document.getElementById('previewFileIcon');
    const fileBadge = document.getElementById('previewFileBadge');
    const downloadBtn = document.getElementById('previewDownloadBtn');
    const errorBtn = document.getElementById('previewErrorDownloadBtn');
    const loader = document.getElementById('previewLoader');
    const loaderText = document.getElementById('previewLoaderText');
    const errorDiv = document.getElementById('previewError');
    
    if (!title || !downloadBtn) {
        console.error('Required preview modal elements missing');
        return false;
    }

    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

    // Reset Title and Download Links
    title.textContent = name || 'Bestand';
    const downloadUrl = `/download?path=${encodeURIComponent(url)}&name=${encodeURIComponent(name || 'bestand')}`;
    
    if (downloadBtn) {
        downloadBtn.href = downloadUrl;
        downloadBtn.target = isStandalone ? "_blank" : "_self";
        downloadBtn.onclick = (e) => {
            e.preventDefault();
            triggerDownload(downloadUrl, name, e.currentTarget);
        };
    }
    if (errorBtn) {
        errorBtn.href = downloadUrl;
        errorBtn.target = isStandalone ? "_blank" : "_self";
        errorBtn.onclick = (e) => {
            e.preventDefault();
            triggerDownload(downloadUrl, name, e.currentTarget);
        };
    }

    // Determine File Categories
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'avif'].includes(ext) || 
                    (typeof url === 'string' && (url.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic|avif)(\?.*)?$/i.test(url)));
    const isPDF = ext === 'pdf';
    const isWord = ['docx', 'doc', 'dotx', 'dot', 'rtf', 'odt'].includes(ext);
    const isExcel = ['xlsx', 'xls', 'csv', 'tsv', 'ods', 'xlsm', 'xltx'].includes(ext);
    const isPPT = ['pptx', 'ppt', 'ppsx', 'pps', 'odp'].includes(ext);
    const isText = ['txt', 'md', 'json', 'log', 'xml'].includes(ext);

    // Update Header Icon & Badge
    updateFileHeader(ext, isImage, isPDF, isWord, isExcel, isPPT, isText, fileIcon, fileBadge);

    // Reset visibility states cleanly
    if (loader) loader.classList.remove('d-none');
    if (frame) frame.classList.add('d-none'); 
    if (imgContainer) imgContainer.classList.add('d-none');
    if (docContainer) {
        docContainer.classList.add('d-none');
        docContainer.innerHTML = '';
    }
    if (errorDiv) errorDiv.classList.add('d-none');

    modal.show();

    // Setup modal close cleanup handler
    const hideHandler = function() {
        cleanupActivePreview();
        modalEl.removeEventListener('hidden.bs.modal', hideHandler);
    };
    modalEl.addEventListener('hidden.bs.modal', hideHandler);

    // ROUTING BY FILE TYPE
    try {
        if (isImage) {
            if (loaderText) loaderText.textContent = 'Afbeelding laden...';
            handleImagePreview(url, img, imgContainer, loader);
        } else if (isPDF && docContainer) {
            if (loaderText) loaderText.textContent = 'PDF voorbereiden...';
            await handlePdfPreview(url, docContainer, loader);
        } else if (isWord && docContainer) {
            if (loaderText) loaderText.textContent = 'Word-document converteren...';
            await handleWordPreview(url, ext, docContainer, loader);
        } else if (isExcel && docContainer) {
            if (loaderText) loaderText.textContent = 'Rekenblad voorbereiden...';
            await handleExcelPreview(url, ext, docContainer, loader);
        } else if (isPPT && docContainer) {
            if (loaderText) loaderText.textContent = 'Presentatie voorbereiden...';
            await handlePptxPreview(url, ext, docContainer, loader);
        } else if (isText && docContainer) {
            if (loaderText) loaderText.textContent = 'Tekstbestand laden...';
            await handleTextPreview(url, docContainer, loader);
        } else {
            showPreviewError('Dit bestandstype kan niet direct worden weergegeven in de browser.');
        }
    } catch (err) {
        console.error('Error during file preview:', err);
        showPreviewError('Er is een fout opgetreden bij het laden van het voorbeeld.');
    }

    return false;
}

/**
 * Handle Image Previews safely
 */
function handleImagePreview(url, img, imgContainer, loader) {
    if (!img || !imgContainer) return;
    img.onload = () => {
        showPreviewSuccess(imgContainer);
    };
    img.onerror = () => {
        showPreviewError('De afbeelding kon niet worden geladen.');
    };
    img.src = url;
}

/**
 * Update the modal header with context-aware icons and badges
 */
function updateFileHeader(ext, isImage, isPDF, isWord, isExcel, isPPT, isText, iconEl, badgeEl) {
    if (!iconEl) return;
    
    let iconClass = 'bi-file-earmark-text';
    let iconColor = 'text-primary';
    let badgeText = (ext || 'bestand').toUpperCase();

    if (isImage) {
        iconClass = 'bi-file-earmark-image-fill';
        iconColor = 'text-info';
    } else if (isPDF) {
        iconClass = 'bi-file-earmark-pdf-fill';
        iconColor = 'text-danger';
    } else if (isWord) {
        iconClass = 'bi-file-earmark-word-fill';
        iconColor = 'text-primary';
    } else if (isExcel) {
        iconClass = 'bi-file-earmark-excel-fill';
        iconColor = 'text-success';
    } else if (isPPT) {
        iconClass = 'bi-file-earmark-ppt-fill';
        iconColor = 'text-warning';
    } else if (isText) {
        iconClass = 'bi-file-earmark-code-fill';
        iconColor = 'text-secondary';
    }

    iconEl.className = `fs-4 ${iconColor} d-flex align-items-center`;
    iconEl.innerHTML = `<i class="bi ${iconClass}"></i>`;

    if (badgeEl) {
        badgeEl.textContent = badgeText;
        badgeEl.classList.remove('d-none');
    }
}

/**
 * Handle PDF Preview with PDF.js on HTML5 Canvas
 * Directly renders pages into high-DPI canvas sheets inside the modal.
 * This completely avoids the mobile Chrome/Android iframe auto-download behavior.
 */
async function handlePdfPreview(url, container, loader) {
    if (previewCache.has(url)) {
        container.innerHTML = previewCache.get(url);
        showPreviewSuccess(container);
        const stage = container.querySelector('.docx-stage');
        const sizer = container.querySelector('.docx-stage-sizer');
        setupPreviewZoom(stage || container.querySelector('#pdfPreviewWrapper') || container, 'pdf', container, sizer);
        return;
    }

    try {
        await loadVendorScript(
            '/vendor/pdf.min.js',
            'pdfjsLib',
            'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'
        );

        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.js';
        }

        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('PDF bestand niet bereikbaar');
        const arrayBuffer = await res.arrayBuffer();

        const loadingTask = window.pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true
        });

        const pdfDoc = await loadingTask.promise;
        const totalPages = pdfDoc.numPages;

        container.innerHTML = '';
        const sizer = document.createElement('div');
        sizer.className = 'docx-stage-sizer';
        const stage = document.createElement('div');
        stage.className = 'docx-stage';

        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-preview-wrapper docx-wrapper';
        wrapper.id = 'pdfPreviewWrapper';

        const pagesContainer = document.createElement('div');
        pagesContainer.className = 'pdf-pages-container';
        pagesContainer.id = 'pdfPagesContainer';

        wrapper.appendChild(pagesContainer);
        stage.appendChild(wrapper);
        sizer.appendChild(stage);
        container.appendChild(sizer);

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            // Render at 1.5x resolution for retina/high-DPI sharpness
            const viewport = page.getViewport({ scale: 1.5 });

            const pageCard = document.createElement('section');
            pageCard.className = 'pdf-page-card docx';
            pageCard.style.width = `${viewport.width}px`;
            pageCard.style.height = `${viewport.height}px`;

            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-canvas';
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = '100%';
            canvas.style.height = '100%';

            const ctx = canvas.getContext('2d');
            pageCard.appendChild(canvas);
            pagesContainer.appendChild(pageCard);

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        }

        previewCache.set(url, container.innerHTML);
        showPreviewSuccess(container);
        setupPreviewZoom(stage, 'pdf', container, sizer);

    } catch (pdfErr) {
        console.warn('PDF.js rendering failed, attempting fallback...', pdfErr);
        await handlePdfIframeFallback(url, loader);
    }
}

/**
 * Fallback PDF iframe preview if PDF.js fails
 */
async function handlePdfIframeFallback(url, loader) {
    const frame = document.getElementById('previewFrame');
    if (!frame) {
        showPreviewError('De PDF kon niet worden weergegeven.');
        return;
    }
    try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Kon PDF niet ophalen');
        const blob = await response.blob();
        activePreviewBlobUrl = window.URL.createObjectURL(blob);
        frame.onload = function() {
            showPreviewSuccess(frame);
        };
        frame.onerror = function() {
            showPreviewError('De PDF kon niet worden weergegeven.');
        };
        frame.src = activePreviewBlobUrl;
    } catch (e) {
        showPreviewError('De PDF kon niet worden weergegeven.');
    }
}

/**
 * Symbol & Bullet Mapping Dictionary
 * Maps proprietary Microsoft Symbol and Wingdings font codes to universal Unicode glyphs.
 */
const WORD_SYMBOL_MAP = {
    0xF0B7: '•', // Round bullet
    0xF0A7: '▪', // Black square bullet
    0xF0A8: '▫', // White square bullet
    0xF0A9: '⯀', // Medium black square
    0xF0AA: '◽', // Medium white square
    0xF0AB: '★', // Black star
    0xF0AC: '☆', // White star
    0xF0AD: '◆', // Black diamond
    0xF0AE: '◇', // White diamond
    0xF0D8: '➢', // Arrowhead pointer
    0xF0D9: '➣', // Arrowhead 2
    0xF0DA: '➤', // Black right arrowhead
    0xF0E8: '➔', // Heavy right arrow
    0xF0E9: '➜', // Arrow right
    0xF0EA: '➝', // Arrow right thin
    0xF0EB: '➔', // Arrow right
    0xF02D: '–', // En dash bullet
    0xF09F: '•', // Small bullet
    0xF076: '◆', // Diamond bullet
    0xF077: '◇', // White diamond
    0xF071: '■', // Square
    0xF072: '□', // White square
    0xF073: '▪', // Small black square
    0xF074: '▫', // Small white square
    0xF075: '◆', // Diamond
    0xF06C: '○', // Circle
    0xF06D: '⦿', // Bullseye
    0xF06E: '■', // Square
    0xF0A1: '★', // Star
    0xF0A2: '☆', // White star
    0xF0A4: '○', // White circle
    0xF0B0: '○', // Degree circle
    0xF0B4: '×', // Multiplication mark
    0xF0D4: '❖', // Diamond
    0xF0DE: '⇒', // Right double arrow
    0xF0DF: '⇔', // Left-right double arrow
    0xF0FC: '✓', // Checkmark
    0xF0FD: '✗', // Cross mark
    0xF0FE: '☑', // Checked box
    0xF0FF: '□', // Empty box / checkbox
    0xF028: '☎', // Phone
    0xF029: '🕾', // Handset
    0xF02A: '✉', // Mail
    0xF03B: '⌛', // Hourglass
    0xF046: '📂', // Folder
    0xF04A: '📄', // Document
    0xF084: '🔑', // Key
    0xF085: '🔑', // Key
    0xF086: '🔒', // Lock
    0xF087: '🔓', // Open lock
    0xF088: '🔔', // Bell
    0xF0E0: '✉', // Envelope
    0xF0E1: '✉', // Envelope
    0xF0E2: '✉'  // Envelope
};

function getUnicodeForSymbol(charHexOrCode) {
    let code = typeof charHexOrCode === 'string' ? parseInt(charHexOrCode, 16) : charHexOrCode;
    if (code < 0x100) code |= 0xF000;
    return WORD_SYMBOL_MAP[code] || '•';
}

/**
 * Normalizes bullet symbols and icons in docx XML before rendering
 */
async function normalizeDocxSymbols(arrayBuffer) {
    if (!window.JSZip) return arrayBuffer;
    try {
        const zip = await window.JSZip.loadAsync(arrayBuffer);
        let modified = false;

        // 1. Process word/numbering.xml
        const numFile = zip.file('word/numbering.xml');
        if (numFile) {
            let numXml = await numFile.async('text');
            const origNumXml = numXml;

            for (const [codeStr, uni] of Object.entries(WORD_SYMBOL_MAP)) {
                const code = parseInt(codeStr, 10);
                const char = String.fromCharCode(code);
                numXml = numXml.split(char).join(uni);

                const hex = '&#x' + code.toString(16).toLowerCase() + ';';
                const hexUpper = '&#x' + code.toString(16).toUpperCase() + ';';
                const dec = '&#' + code.toString(10) + ';';
                numXml = numXml.split(hex).join(uni);
                numXml = numXml.split(hexUpper).join(uni);
                numXml = numXml.split(dec).join(uni);
            }

            numXml = numXml.replace(/<w:lvl\b[^>]*>[\s\S]*?<\/w:lvl>/gi, (lvlBlock) => {
                let cleaned = lvlBlock;
                cleaned = cleaned.replace(/(<w:lvlText\s+[^>]*w:val=\")[oO](\"[^>]*\/>)/g, '$1○$2');
                if (/w:val=\"bullet\"/i.test(cleaned)) {
                    cleaned = cleaned.replace(/<w:rFonts\b[^>]*\/>/gi, '');
                    cleaned = cleaned.replace(/<w:rFonts\b[^>]*>[\s\S]*?<\/w:rFonts>/gi, '');
                }
                cleaned = cleaned.replace(/<w:rFonts\b[^>]*(?:Symbol|Wingdings|Webdings)[^>]*\/>/gi, '');
                cleaned = cleaned.replace(/<w:rFonts\b[^>]*(?:Symbol|Wingdings|Webdings)[^>]*>[\s\S]*?<\/w:rFonts>/gi, '');
                return cleaned;
            });

            numXml = numXml.replace(/[\uF000-\uF0FF]/g, (ch) => getUnicodeForSymbol(ch.charCodeAt(0)));

            if (numXml !== origNumXml) {
                zip.file('word/numbering.xml', numXml);
                modified = true;
            }
        }

        // 2. Process all text XML files
        const xmlFiles = zip.file(/^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/);
        for (const file of xmlFiles) {
            let xml = await file.async('text');
            const origXml = xml;

            xml = xml.replace(/<w:sym [^>]*w:char=\"([0-9a-fA-F]+)\"[^>]*\/?>/g, (match, hex) => {
                const uni = getUnicodeForSymbol(hex);
                return '<w:t>' + uni + '</w:t>';
            });

            xml = xml.replace(/[\uF000-\uF0FF]/g, (ch) => {
                return getUnicodeForSymbol(ch.charCodeAt(0));
            });

            for (const [codeStr, uni] of Object.entries(WORD_SYMBOL_MAP)) {
                const code = parseInt(codeStr, 10);
                const hex = '&#x' + code.toString(16).toLowerCase() + ';';
                const hexUpper = '&#x' + code.toString(16).toUpperCase() + ';';
                const dec = '&#' + code.toString(10) + ';';
                if (xml.includes(hex)) xml = xml.split(hex).join(uni);
                if (xml.includes(hexUpper)) xml = xml.split(hexUpper).join(uni);
                if (xml.includes(dec)) xml = xml.split(dec).join(uni);
            }

            if (xml !== origXml) {
                zip.file(file.name, xml);
                modified = true;
            }
        }

        if (modified) {
            return await zip.generateAsync({ type: 'arraybuffer' });
        }
    } catch (err) {
        console.warn('Symbol normalization skipped due to parse error:', err);
    }
    return arrayBuffer;
}

/**
 * Handle Word Document (.docx / .doc) Preview
 * Preserves true A4 page layout without squishing into mobile width,
 * and attaches responsive zoom and pan gestures.
 */
async function handleWordPreview(url, ext, container, loader) {
    if (previewCache.has(url)) {
        container.innerHTML = previewCache.get(url);
        showPreviewSuccess(container);
        const stage = container.querySelector('.docx-stage');
        const sizer = container.querySelector('.docx-stage-sizer');
        setupPreviewZoom(stage || container.querySelector('.docx-wrapper') || container, 'docx', container, sizer);
        return;
    }

    if (ext === 'docx') {
        try {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Bestand niet bereikbaar');
            const arrayBuffer = await res.arrayBuffer();

            // Lazy-load JSZip and docx-preview
            await loadVendorScript(
                '/vendor/jszip.min.js',
                'JSZip',
                'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
            );
            await loadVendorScript(
                '/vendor/docx-preview.min.js',
                'docx',
                'https://cdn.jsdelivr.net/npm/docx-preview@0.4.1/dist/docx-preview.min.js'
            );

            const cleanArrayBuffer = await normalizeDocxSymbols(arrayBuffer);

            container.innerHTML = '';
            const sizer = document.createElement('div');
            sizer.className = 'docx-stage-sizer';
            const stage = document.createElement('div');
            stage.className = 'docx-stage';

            sizer.appendChild(stage);
            container.appendChild(sizer);

            // Keep true A4 format! Do NOT ignore width or height!
            await window.docx.renderAsync(cleanArrayBuffer, stage, null, {
                className: "docx",
                inWrapper: true,
                ignoreWidth: false,
                ignoreHeight: false,
                ignoreFonts: false,
                breakPages: true,
                useBase64URL: true,
                renderHeaders: true,
                renderFooters: true,
                renderFootnotes: true,
                renderEndnotes: true
            });

            previewCache.set(url, container.innerHTML);
            showPreviewSuccess(container);
            setupPreviewZoom(stage, 'docx', container, sizer);
            return;
        } catch (docxErr) {
            console.warn('docx-preview failed, attempting mammoth fallback...', docxErr);
            try {
                const res = await fetch(url, { credentials: 'same-origin' });
                const arrayBuffer = await res.arrayBuffer();

                await loadVendorScript(
                    '/vendor/mammoth.browser.min.js',
                    'mammoth',
                    'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js'
                );

                const conversionResult = await window.mammoth.convertToHtml({ arrayBuffer });
                let html = conversionResult.value;

                if (!html || html.trim() === '') {
                    html = '<p class="text-muted text-center py-4"><em>Dit Word-document bevat geen zichtbare tekst of secties.</em></p>';
                }

                container.innerHTML = '';
                const sizer = document.createElement('div');
                sizer.className = 'docx-stage-sizer';
                const stage = document.createElement('div');
                stage.className = 'docx-stage';

                const markup = `
                    <div class="docx-preview-container">
                        <div class="docx-paper">
                            ${html}
                        </div>
                    </div>
                `;

                stage.innerHTML = markup;
                sizer.appendChild(stage);
                container.appendChild(sizer);

                previewCache.set(url, container.innerHTML);
                showPreviewSuccess(container);
                setupPreviewZoom(stage, 'docx', container, sizer);
                return;
            } catch (clientErr) {
                console.warn('Client-side Mammoth conversion also failed, falling back to server preview...', clientErr);
            }
        }
    }

    // Legacy .doc or fallback to server conversion
    await handleServerDocPreview(url, container, loader);
}

/**
 * Trims empty trailing columns/rows from SheetJS worksheet to prevent awkward stretched tables
 */
function cleanWorksheetRange(worksheet) {
    if (!worksheet || !worksheet['!ref']) return;
    try {
        let maxR = 0, maxC = 0;
        let hasCells = false;
        Object.keys(worksheet).forEach(k => {
            if (k.startsWith('!')) return;
            const cell = window.XLSX.utils.decode_cell(k);
            const val = worksheet[k] ? worksheet[k].v : undefined;
            if (val !== undefined && val !== '' && val !== null) {
                hasCells = true;
                if (cell.r > maxR) maxR = cell.r;
                if (cell.c > maxC) maxC = cell.c;
            }
        });
        if (hasCells) {
            worksheet['!ref'] = window.XLSX.utils.encode_range({
                s: { r: 0, c: 0 },
                e: { r: maxR, c: maxC }
            });
        }
    } catch (e) {
        // Safe fallback
    }
}

/**
 * Handle Excel / Spreadsheet (.xlsx, .xls, .csv, .tsv) Preview
 * Converts sheets to clean, structured HTML tables without distorted columns,
 * with horizontal scrolling and zoom controls.
 */
async function handleExcelPreview(url, ext, container, loader) {
    if (previewCache.has(url)) {
        container.innerHTML = previewCache.get(url);
        showPreviewSuccess(container);
        initExcelInteractiveEvents(container);
        setupPreviewZoom(container.querySelector('#excelTableArea'), 'xlsx');
        return;
    }

    try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Bestand niet bereikbaar');
        const arrayBuffer = await res.arrayBuffer();

        await loadVendorScript(
            '/vendor/xlsx.full.min.js',
            'XLSX',
            'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
        );

        const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('Geen werkbladen gevonden in rekenblad.');
        }

        const sheetMap = {};
        workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            
            // Trim empty padding columns/rows
            cleanWorksheetRange(worksheet);

            const rawTable = window.XLSX.utils.sheet_to_html(worksheet, { id: 'sheetTable' });
            // Use dedicated excel-table class without Bootstrap .table
            sheetMap[sheetName] = rawTable.replace('<table', '<table class="excel-table"');
        });

        const tabsHtml = workbook.SheetNames.map((name, idx) => `
            <button type="button" class="nav-link ${idx === 0 ? 'active' : ''} px-3 py-1 btn-sm" data-sheet="${escapeHtml(name)}">
                <i class="bi bi-file-earmark-spreadsheet me-1"></i>${escapeHtml(name)}
            </button>
        `).join('');

        const firstSheetName = workbook.SheetNames[0];
        const markup = `
            <div class="excel-preview-container">
                <div class="excel-toolbar">
                    <div class="excel-sheet-tabs nav nav-pills" id="excelTabs">
                        ${tabsHtml}
                    </div>
                    <div class="d-flex align-items-center gap-2 ms-auto">
                        <input type="search" class="form-control form-control-sm rounded-pill" id="excelSearchInput" placeholder="Zoeken in tabel..." style="max-width: 170px;">
                        <span class="text-muted small text-nowrap d-none d-sm-inline" id="excelSheetCounter">
                            ${workbook.SheetNames.length} werkblad(en)
                        </span>
                    </div>
                </div>
                <div class="excel-table-scroll" id="excelTableArea">
                    ${sheetMap[firstSheetName]}
                </div>
            </div>
        `;

        previewCache.set(url, markup);
        container.innerHTML = markup;
        showPreviewSuccess(container);

        initExcelInteractiveEvents(container, sheetMap);
        setupPreviewZoom(container.querySelector('#excelTableArea'), 'xlsx');

    } catch (err) {
        console.warn('Client-side Excel preview failed, trying server...', err);
        await handleServerDocPreview(url, container, loader);
    }
}

/**
 * Setup interactions for Excel sheets: tabs, search filtering, and cell tap expand
 */
function initExcelInteractiveEvents(container, sheetMap) {
    const tabsContainer = container.querySelector('#excelTabs');
    const tableArea = container.querySelector('#excelTableArea');
    const searchInput = container.querySelector('#excelSearchInput');

    if (tabsContainer && tableArea && sheetMap) {
        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-sheet]');
            if (!btn) return;
            tabsContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const sheetName = btn.getAttribute('data-sheet');
            if (sheetMap[sheetName]) {
                tableArea.innerHTML = sheetMap[sheetName];
                if (searchInput) searchInput.value = '';
                setupPreviewZoom(tableArea, 'xlsx');
            }
        });
    }

    if (searchInput && tableArea) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            const rows = tableArea.querySelectorAll('tbody tr, table tr:not(:first-child)');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                if (!query || text.includes(query)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }

    // Toggle cell expansion on click for long truncated text on mobile
    if (tableArea) {
        tableArea.addEventListener('click', (e) => {
            const td = e.target.closest('td');
            if (!td) return;
            td.classList.toggle('cell-expanded');
        });
    }
}

/**
 * Handle PowerPoint (.pptx) Preview using client-side Canvas rendering
 */
async function handlePptxPreview(url, ext, container, loader) {
    if (ext === 'pptx') {
        try {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Bestand niet bereikbaar');
            const arrayBuffer = await res.arrayBuffer();

            const PptxRenderer = await loadPptxRenderer();
            const renderer = new PptxRenderer();
            activePptxRenderer = renderer;

            await renderer.load(arrayBuffer);

            if (renderer.slideCount === 0) {
                throw new Error('Geen slides gevonden in presentatie.');
            }

            let currentSlide = 0;
            const slideCount = renderer.slideCount;

            let thumbsHtml = '';
            for (let i = 0; i < slideCount; i++) {
                thumbsHtml += `
                    <button class="pptx-thumb-btn ${i === 0 ? 'active' : ''}" data-slide="${i}">
                        Slide ${i + 1}
                    </button>
                `;
            }

            const markup = `
                <div class="pptx-preview-container">
                    <div class="pptx-toolbar">
                        <div class="d-flex align-items-center gap-2">
                            <button class="btn btn-sm btn-outline-light rounded-pill px-3" id="pptxPrevBtn" ${currentSlide === 0 ? 'disabled' : ''}>
                                <i class="bi bi-chevron-left me-1"></i> Vorige
                            </button>
                            <span class="text-light fw-bold mx-2 small" id="pptxSlideCounter">
                                Slide 1 van ${slideCount}
                            </span>
                            <button class="btn btn-sm btn-outline-light rounded-pill px-3" id="pptxNextBtn" ${slideCount <= 1 ? 'disabled' : ''}>
                                Volgende <i class="bi bi-chevron-right ms-1"></i>
                            </button>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <button class="btn btn-sm btn-outline-secondary text-light rounded-pill px-2" id="pptxToggleThumbsBtn" title="Miniaturen tonen/verbergen">
                                <i class="bi bi-grid-fill me-1"></i> <span class="d-none d-sm-inline">Slides</span>
                            </button>
                        </div>
                    </div>
                    <div class="pptx-stage" id="pptxStage">
                        <canvas id="pptxCanvas" class="pptx-canvas"></canvas>
                    </div>
                    <div class="pptx-thumb-strip d-none" id="pptxThumbStrip">
                        ${thumbsHtml}
                    </div>
                </div>
            `;

            container.innerHTML = markup;
            showPreviewSuccess(container);

            const canvas = container.querySelector('#pptxCanvas');
            const prevBtn = container.querySelector('#pptxPrevBtn');
            const nextBtn = container.querySelector('#pptxNextBtn');
            const counter = container.querySelector('#pptxSlideCounter');
            const toggleThumbsBtn = container.querySelector('#pptxToggleThumbsBtn');
            const thumbStrip = container.querySelector('#pptxThumbStrip');
            const thumbBtns = container.querySelectorAll('.pptx-thumb-btn');

            async function renderCurrentSlide(slideIdx) {
                if (slideIdx < 0 || slideIdx >= slideCount) return;
                currentSlide = slideIdx;
                counter.textContent = `Slide ${currentSlide + 1} van ${slideCount}`;
                prevBtn.disabled = (currentSlide === 0);
                nextBtn.disabled = (currentSlide === slideCount - 1);
                
                thumbBtns.forEach((btn, idx) => {
                    btn.classList.toggle('active', idx === currentSlide);
                });

                await renderer.renderSlide(currentSlide, canvas, 1280);
            }

            await renderCurrentSlide(0);

            prevBtn.onclick = () => renderCurrentSlide(currentSlide - 1);
            nextBtn.onclick = () => renderCurrentSlide(currentSlide + 1);

            toggleThumbsBtn.onclick = () => {
                thumbStrip.classList.toggle('d-none');
            };

            thumbBtns.forEach(btn => {
                btn.onclick = () => {
                    const idx = parseInt(btn.getAttribute('data-slide'), 10);
                    renderCurrentSlide(idx);
                };
            });

            activeKeydownHandler = (e) => {
                if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
                    e.preventDefault();
                    renderCurrentSlide(currentSlide + 1);
                } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                    e.preventDefault();
                    renderCurrentSlide(currentSlide - 1);
                }
            };
            window.addEventListener('keydown', activeKeydownHandler);

            const stage = container.querySelector('#pptxStage');
            let touchStartX = 0;
            let touchEndX = 0;
            stage.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });
            stage.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                const diff = touchEndX - touchStartX;
                if (diff < -50) {
                    renderCurrentSlide(currentSlide + 1);
                } else if (diff > 50) {
                    renderCurrentSlide(currentSlide - 1);
                }
            }, { passive: true });

            return;
        } catch (clientErr) {
            console.warn('Client-side PPTX preview failed, falling back to server...', clientErr);
        }
    }

    // Legacy .ppt or fallback
    await handleServerDocPreview(url, container, loader);
}

/**
 * Handle Plain Text / Code / Markdown Preview
 */
async function handleTextPreview(url, container, loader) {
    try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Bestand niet bereikbaar');
        const text = await res.text();

        const markup = `
            <div class="text-preview-container">
                <pre class="text-preview-code"><code>${escapeHtml(text)}</code></pre>
            </div>
        `;

        container.innerHTML = markup;
        showPreviewSuccess(container);
    } catch (err) {
        showPreviewError('Het tekstbestand kon niet worden geladen.');
    }
}

/**
 * Server-assisted Preview Fallback
 * Calls /api/document-preview to convert legacy .doc, .ppt, etc. on-the-fly to HTML
 */
async function handleServerDocPreview(url, container, loader) {
    try {
        const previewUrl = `/api/document-preview?path=${encodeURIComponent(url)}`;
        const res = await fetch(previewUrl, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Server conversie mislukt');
        
        const data = await res.json();
        if (!data.success || !data.html) {
            throw new Error(data.error || 'Geen HTML beschikbaar');
        }

        container.innerHTML = '';
        const sizer = document.createElement('div');
        sizer.className = 'docx-stage-sizer';
        const stage = document.createElement('div');
        stage.className = 'docx-stage';

        const markup = `
            <div class="docx-preview-container">
                <div class="docx-paper">
                    ${data.html}
                </div>
            </div>
        `;

        stage.innerHTML = markup;
        sizer.appendChild(stage);
        container.appendChild(sizer);

        previewCache.set(url, container.innerHTML);
        showPreviewSuccess(container);
        setupPreviewZoom(stage, 'doc', container, sizer);
    } catch (serverErr) {
        console.error('Server document conversion failed:', serverErr);
        showPreviewError('Dit bestandstype kan niet direct worden weergegeven in de browser.');
    }
}

/**
 * Unify preview success:
 * Explicitly hides loader & errorDiv, and displays only the active container.
 */
function showPreviewSuccess(activeEl) {
    const loader = document.getElementById('previewLoader');
    const errorDiv = document.getElementById('previewError');
    const frame = document.getElementById('previewFrame');
    const imgContainer = document.getElementById('previewImageContainer');
    const docContainer = document.getElementById('previewDocContainer');

    if (loader) loader.classList.add('d-none');
    
    // Explicitly hide error fallback and clear text
    if (errorDiv) {
        errorDiv.classList.add('d-none');
        const errorMsg = document.getElementById('previewErrorMessage');
        if (errorMsg) errorMsg.textContent = '';
    }

    if (frame && activeEl !== frame) {
        frame.classList.add('d-none');
        frame.removeAttribute('src');
    }
    if (imgContainer && activeEl !== imgContainer) {
        imgContainer.classList.add('d-none');
    }
    if (docContainer && activeEl !== docContainer) {
        docContainer.classList.add('d-none');
    }

    if (activeEl) {
        activeEl.classList.remove('d-none');
    }
}

/**
 * Display a user-friendly error card inside the preview modal
 */
function showPreviewError(msg) {
    const docContainer = document.getElementById('previewDocContainer');
    const imgContainer = document.getElementById('previewImageContainer');
    const frame = document.getElementById('previewFrame');

    // If content has already been successfully rendered and displayed, do not show error over it
    if (docContainer && !docContainer.classList.contains('d-none') && docContainer.children.length > 0) {
        console.warn('Ignoring showPreviewError because docContainer is already populated and visible:', msg);
        return;
    }
    if (imgContainer && !imgContainer.classList.contains('d-none')) {
        return;
    }
    if (frame && !frame.classList.contains('d-none')) {
        return;
    }

    const loader = document.getElementById('previewLoader');
    const errorDiv = document.getElementById('previewError');
    const errorMsg = document.getElementById('previewErrorMessage');
    const zoomToolbar = document.getElementById('previewZoomToolbar');

    if (loader) loader.classList.add('d-none');
    if (frame) frame.classList.add('d-none');
    if (imgContainer) imgContainer.classList.add('d-none');
    if (docContainer) docContainer.classList.add('d-none');
    if (zoomToolbar) zoomToolbar.classList.add('d-none');

    if (errorDiv) {
        if (errorMsg && msg) errorMsg.textContent = msg;
        errorDiv.classList.remove('d-none');
    }
}

/**
 * Setup responsive zoom controls, touch pinch-to-zoom & page navigation for Word, PDF & Excel documents
 */
function setupPreviewZoom(targetEl, type, scrollContainer, sizerEl) {
    teardownPreviewZoom();
    if (!targetEl) return;

    activeZoomTarget = targetEl;
    activeZoomSizer = sizerEl || null;
    activeScrollContainer = scrollContainer || document.getElementById('previewDocContainer');

    const toolbar = document.getElementById('previewZoomToolbar');
    const outBtn = document.getElementById('previewZoomOutBtn');
    const inBtn = document.getElementById('previewZoomInBtn');
    const fitBtn = document.getElementById('previewZoomFitBtn');
    const label = document.getElementById('previewZoomLabel');

    if (!toolbar) return;

    toolbar.classList.remove('d-none');

    const containerEl = activeScrollContainer || document.querySelector('#filePreviewModal .modal-body');
    const availableWidth = containerEl ? containerEl.clientWidth : window.innerWidth;

    // Detect natural content width (e.g. 794px for A4 docx/pdf)
    let naturalWidth = 794;
    const pageEl = targetEl.querySelector('section.docx, .pdf-page-card, .docx-paper');
    if (pageEl && pageEl.offsetWidth > 100) {
        naturalWidth = pageEl.offsetWidth;
    } else if (targetEl.offsetWidth > 100) {
        naturalWidth = targetEl.offsetWidth;
    }

    const isMobile = window.innerWidth <= 768;

    if (type === 'docx' || type === 'pdf' || type === 'doc') {
        const paddingOffset = isMobile ? 16 : 32;
        defaultFitZoom = Math.min(1.0, Math.max(0.28, (availableWidth - paddingOffset) / naturalWidth));
        currentPreviewZoom = defaultFitZoom;
    } else {
        defaultFitZoom = 1.0;
        currentPreviewZoom = 1.0;
    }

    applyPreviewZoom(targetEl, currentPreviewZoom, label, activeScrollContainer, activeZoomSizer, naturalWidth);

    inBtn.onclick = (e) => {
        e.stopPropagation();
        currentPreviewZoom = Math.min(3.0, Math.round((currentPreviewZoom + 0.15) * 100) / 100);
        applyPreviewZoom(targetEl, currentPreviewZoom, label, activeScrollContainer, activeZoomSizer, naturalWidth);
    };

    outBtn.onclick = (e) => {
        e.stopPropagation();
        currentPreviewZoom = Math.max(defaultFitZoom * 0.7, Math.round((currentPreviewZoom - 0.15) * 100) / 100);
        applyPreviewZoom(targetEl, currentPreviewZoom, label, activeScrollContainer, activeZoomSizer, naturalWidth);
    };

    fitBtn.onclick = (e) => {
        e.stopPropagation();
        if (Math.abs(currentPreviewZoom - defaultFitZoom) < 0.04) {
            currentPreviewZoom = 1.0;
        } else {
            currentPreviewZoom = defaultFitZoom;
        }
        applyPreviewZoom(targetEl, currentPreviewZoom, label, activeScrollContainer, activeZoomSizer, naturalWidth);
    };

    // Setup multi-page navigation for multi-page Word & PDF
    setupDocumentPageNavigation(activeScrollContainer, targetEl);

    // Setup anchored pinch-to-zoom & double-tap zoom
    setupPinchToZoom(activeScrollContainer, targetEl, label, activeZoomSizer, naturalWidth);

    // Window resize handler to maintain fit
    activeResizeHandler = () => {
        if (!activeZoomTarget) return;
        const newAvailableWidth = activeScrollContainer ? activeScrollContainer.clientWidth : window.innerWidth;
        const paddingOffset = window.innerWidth <= 768 ? 16 : 32;
        defaultFitZoom = Math.min(1.0, Math.max(0.28, (newAvailableWidth - paddingOffset) / naturalWidth));
        if (Math.abs(currentPreviewZoom - defaultFitZoom) < 0.08) {
            currentPreviewZoom = defaultFitZoom;
            applyPreviewZoom(targetEl, currentPreviewZoom, label, activeScrollContainer, activeZoomSizer, naturalWidth);
        }
    };
    window.addEventListener('resize', activeResizeHandler);
}

function applyPreviewZoom(targetEl, zoomLevel, label, scrollContainer, sizerEl, contentNaturalWidth) {
    if (!targetEl) return;
    currentPreviewZoom = zoomLevel;

    const baseWidth = contentNaturalWidth || 794;
    const baseHeight = targetEl.scrollHeight || targetEl.offsetHeight || 1123;
    const scaledWidth = Math.round(baseWidth * zoomLevel);
    const scaledHeight = Math.round(baseHeight * zoomLevel);

    // Use transform scale for GPU acceleration without mutating physical document layout
    targetEl.style.transformOrigin = 'top left';
    targetEl.style.transform = `scale(${zoomLevel})`;

    if (sizerEl) {
        sizerEl.style.width = `${scaledWidth}px`;
        sizerEl.style.height = `${scaledHeight}px`;

        const vWidth = scrollContainer ? scrollContainer.clientWidth : window.innerWidth;
        if (scaledWidth < vWidth) {
            const offset = Math.max(0, Math.floor((vWidth - scaledWidth) / 2));
            sizerEl.style.marginLeft = `${offset}px`;
            sizerEl.style.marginRight = 'auto';
        } else {
            // When zoomed in, align strictly to 0 so the left side is never cut off
            sizerEl.style.marginLeft = '0px';
            sizerEl.style.marginRight = '0px';
        }
    } else {
        // Fallback for elements without a sizer (e.g. table areas)
        if ('zoom' in targetEl.style && targetEl.tagName === 'DIV') {
            targetEl.style.zoom = zoomLevel;
            targetEl.style.transform = '';
        } else {
            targetEl.style.transformOrigin = 'top left';
            targetEl.style.transform = `scale(${zoomLevel})`;
        }
    }

    if (label) {
        if (Math.abs(zoomLevel - defaultFitZoom) < 0.04) {
            label.textContent = 'Passend';
        } else {
            label.textContent = `${Math.round(zoomLevel * 100)}%`;
        }
    }
}

/**
 * Setup intuitive document page navigation (Page counter, Next/Prev buttons, scroll-spy)
 */
function setupDocumentPageNavigation(scrollContainer, stageEl) {
    const pageNav = document.getElementById('previewPageNav');
    const prevBtn = document.getElementById('previewPrevPageBtn');
    const nextBtn = document.getElementById('previewNextPageBtn');
    const pageLabel = document.getElementById('previewPageLabel');

    if (!pageNav || !prevBtn || !nextBtn || !pageLabel || !stageEl || !scrollContainer) return;

    const pages = stageEl.querySelectorAll('section.docx, .pdf-page-card');
    const totalPages = pages.length;

    if (totalPages <= 1) {
        pageNav.classList.add('d-none');
        return;
    }

    pageNav.classList.remove('d-none');

    let activePageIndex = 0;

    const updateControls = () => {
        prevBtn.disabled = (activePageIndex <= 0);
        nextBtn.disabled = (activePageIndex >= totalPages - 1);
        pageLabel.textContent = `${activePageIndex + 1} / ${totalPages}`;
    };

    updateControls();

    prevBtn.onclick = (e) => {
        e.stopPropagation();
        if (activePageIndex > 0) {
            activePageIndex--;
            pages[activePageIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
            updateControls();
        }
    };

    nextBtn.onclick = (e) => {
        e.stopPropagation();
        if (activePageIndex < totalPages - 1) {
            activePageIndex++;
            pages[activePageIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
            updateControls();
        }
    };

    // Track scroll to update current page indicator smoothly
    let isTicking = false;
    activeDocScrollHandler = () => {
        if (isTicking) return;
        isTicking = true;
        window.requestAnimationFrame(() => {
            const vRect = scrollContainer.getBoundingClientRect();
            const checkY = vRect.top + vRect.height * 0.35;
            for (let i = 0; i < totalPages; i++) {
                const pRect = pages[i].getBoundingClientRect();
                if (pRect.top <= checkY && pRect.bottom >= checkY) {
                    if (activePageIndex !== i) {
                        activePageIndex = i;
                        updateControls();
                    }
                    break;
                }
            }
            isTicking = false;
        });
    };
    scrollContainer.addEventListener('scroll', activeDocScrollHandler, { passive: true });

    // Keyboard navigation (PageUp / PageDown)
    activeDocKeyHandler = (e) => {
        if (e.key === 'PageDown' || (e.key === 'ArrowDown' && (e.altKey || e.metaKey))) {
            e.preventDefault();
            nextBtn.click();
        } else if (e.key === 'PageUp' || (e.key === 'ArrowUp' && (e.altKey || e.metaKey))) {
            e.preventDefault();
            prevBtn.click();
        }
    };
    window.addEventListener('keydown', activeDocKeyHandler);
}

/**
 * Enhanced Touch Gestures: Anchored pinch-to-zoom & double-tap to zoom
 */
function setupPinchToZoom(scrollContainer, targetEl, label, sizerEl, contentNaturalWidth) {
    if (!scrollContainer || !targetEl) return;

    let initialDistance = 0;
    let initialZoom = currentPreviewZoom;
    let initialScrollLeft = 0;
    let initialScrollTop = 0;
    let focalX = 0;
    let focalY = 0;

    const onTouchStart = (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            initialDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialZoom = currentPreviewZoom;
            initialScrollLeft = scrollContainer.scrollLeft;
            initialScrollTop = scrollContainer.scrollTop;

            focalX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            focalY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        }
    };

    const onTouchMove = (e) => {
        if (e.touches.length === 2 && initialDistance > 0) {
            e.preventDefault();
            const currentDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const scaleFactor = currentDistance / initialDistance;
            let newZoom = initialZoom * scaleFactor;
            newZoom = Math.min(3.0, Math.max(defaultFitZoom * 0.7, Math.round(newZoom * 100) / 100));

            const prevZoom = currentPreviewZoom;
            currentPreviewZoom = newZoom;
            applyPreviewZoom(targetEl, currentPreviewZoom, label, scrollContainer, sizerEl, contentNaturalWidth);

            // Anchor scroll position to focal point so content under fingers stays steady
            if (prevZoom > 0) {
                const ratio = currentPreviewZoom / prevZoom;
                scrollContainer.scrollLeft = Math.max(0, (initialScrollLeft + focalX) * ratio - focalX);
                scrollContainer.scrollTop = Math.max(0, (initialScrollTop + focalY) * ratio - focalY);
            }
        }
    };

    const onTouchEnd = (e) => {
        if (e.touches.length < 2) {
            initialDistance = 0;
        }
    };

    scrollContainer.addEventListener('touchstart', onTouchStart, { passive: false });
    scrollContainer.addEventListener('touchmove', onTouchMove, { passive: false });
    scrollContainer.addEventListener('touchend', onTouchEnd, { passive: false });

    // Double-tap to toggle between fit-to-screen and comfortable reading zoom (1.5x)
    let lastTapTime = 0;
    const onDoubleTap = (e) => {
        if (e.touches.length > 0) return;
        const now = Date.now();
        if (now - lastTapTime < 320) {
            e.preventDefault();
            if (Math.abs(currentPreviewZoom - defaultFitZoom) < 0.08) {
                currentPreviewZoom = Math.min(2.0, defaultFitZoom * 1.6);
            } else {
                currentPreviewZoom = defaultFitZoom;
            }
            applyPreviewZoom(targetEl, currentPreviewZoom, label, scrollContainer, sizerEl, contentNaturalWidth);
        }
        lastTapTime = now;
    };
    scrollContainer.addEventListener('touchend', onDoubleTap, { passive: false });

    activeTouchListeners = { scrollContainer, onTouchStart, onTouchMove, onTouchEnd, onDoubleTap };
}

function teardownPreviewZoom() {
    if (activeTouchListeners) {
        const { scrollContainer, onTouchStart, onTouchMove, onTouchEnd, onDoubleTap } = activeTouchListeners;
        if (scrollContainer) {
            scrollContainer.removeEventListener('touchstart', onTouchStart);
            scrollContainer.removeEventListener('touchmove', onTouchMove);
            scrollContainer.removeEventListener('touchend', onTouchEnd);
            scrollContainer.removeEventListener('touchend', onDoubleTap);
        }
        activeTouchListeners = null;
    }
    if (activeDocScrollHandler && activeScrollContainer) {
        activeScrollContainer.removeEventListener('scroll', activeDocScrollHandler);
        activeDocScrollHandler = null;
    }
    if (activeDocKeyHandler) {
        window.removeEventListener('keydown', activeDocKeyHandler);
        activeDocKeyHandler = null;
    }
    if (activeResizeHandler) {
        window.removeEventListener('resize', activeResizeHandler);
        activeResizeHandler = null;
    }
    if (activeZoomTarget) {
        activeZoomTarget.style.zoom = '';
        activeZoomTarget.style.transform = '';
        activeZoomTarget = null;
    }
    if (activeZoomSizer) {
        activeZoomSizer.style.width = '';
        activeZoomSizer.style.height = '';
        activeZoomSizer.style.marginLeft = '';
        activeZoomSizer.style.marginRight = '';
        activeZoomSizer = null;
    }
    activeScrollContainer = null;
    const toolbar = document.getElementById('previewZoomToolbar');
    if (toolbar) toolbar.classList.add('d-none');
    const pageNav = document.getElementById('previewPageNav');
    if (pageNav) pageNav.classList.add('d-none');
    currentPreviewZoom = 1.0;
}

/**
 * Clean up active resources (blob URLs, pptx renderers, listeners)
 */
function cleanupActivePreview() {
    if (activePreviewBlobUrl) {
        window.URL.revokeObjectURL(activePreviewBlobUrl);
        activePreviewBlobUrl = null;
    }

    if (activePptxRenderer) {
        try {
            activePptxRenderer.destroy();
        } catch (e) {
            console.error('Error destroying PPTX renderer:', e);
        }
        activePptxRenderer = null;
    }

    if (activeKeydownHandler) {
        window.removeEventListener('keydown', activeKeydownHandler);
        activeKeydownHandler = null;
    }

    teardownPreviewZoom();

    const docContainer = document.getElementById('previewDocContainer');
    if (docContainer) {
        docContainer.innerHTML = '';
        docContainer.classList.add('d-none');
    }

    const img = document.getElementById('previewImage');
    if (img) {
        img.onload = null;
        img.onerror = null;
        img.removeAttribute('src');
    }

    const frame = document.getElementById('previewFrame');
    if (frame) {
        frame.onload = null;
        frame.onerror = null;
        frame.removeAttribute('src');
    }

    const errorDiv = document.getElementById('previewError');
    if (errorDiv) {
        errorDiv.classList.add('d-none');
    }
}
