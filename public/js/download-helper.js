/**
 * download-helper.js
 * Centralized logic for file downloads and rich client-side document previews.
 * Converts DOCX, XLSX, XLS, PPTX, CSV, and text files directly to HTML in the browser.
 */

// Keep track of active blob URLs, renderers, and caches
let activePreviewBlobUrl = null;
let activePptxRenderer = null;
let activeKeydownHandler = null;
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

    // Detect if the user is on an iOS device and if they are in Standalone (PWA) mode
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
        const downloadUrl = `/download?path=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
        window.location.href = downloadUrl;
        return false;
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
    const errorMessage = document.getElementById('previewErrorMessage');
    
    if (!frame || !img || !title || !downloadBtn) {
        console.error('Required preview modal elements missing');
        return false;
    }

    // Cleanup previous preview state
    cleanupActivePreview();

    if (typeof url === 'string' && url.startsWith('/uploads/feed/')) {
        url = url.replace('/uploads/feed/', '/feed_uploads/');
    }

    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

    // Reset Title and Download Links
    title.textContent = name || 'Bestand';
    const downloadUrl = `/download?path=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
    
    downloadBtn.href = downloadUrl;
    if (errorBtn) errorBtn.href = downloadUrl;
    
    if (isStandalone) {
        downloadBtn.target = "_blank";
        downloadBtn.rel = "noopener noreferrer";
        if (errorBtn) {
            errorBtn.target = "_blank";
            errorBtn.rel = "noopener noreferrer";
        }
    } else {
        downloadBtn.target = "_self";
        if (errorBtn) errorBtn.target = "_self";
    }

    const downloadHandler = (e) => {
        e.preventDefault();
        triggerDownload(downloadUrl, name, e.currentTarget);
    };
    
    downloadBtn.onclick = downloadHandler;
    if (errorBtn) errorBtn.onclick = downloadHandler;

    // Determine File Extension and Categories
    const ext = (name && name.includes('.')) ? name.split('.').pop().toLowerCase() : '';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'avif'].includes(ext) || 
                    (typeof url === 'string' && (url.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic|avif)(\?.*)?$/i.test(url)));
    const isPDF = ext === 'pdf';
    const isWord = ['docx', 'doc', 'dotx', 'dot', 'rtf', 'odt'].includes(ext);
    const isExcel = ['xlsx', 'xls', 'csv', 'tsv', 'ods', 'xlsm', 'xltx'].includes(ext);
    const isPPT = ['pptx', 'ppt', 'ppsx', 'pps', 'odp'].includes(ext);
    const isText = ['txt', 'md', 'json', 'log', 'xml'].includes(ext);

    // Update Header Icon & Badge
    updateFileHeader(ext, isImage, isPDF, isWord, isExcel, isPPT, isText, fileIcon, fileBadge);

    // Reset visibility
    loader.classList.remove('d-none');
    frame.classList.add('d-none'); 
    imgContainer.classList.add('d-none');
    if (docContainer) {
        docContainer.classList.add('d-none');
        docContainer.innerHTML = '';
    }
    errorDiv.classList.add('d-none');
    frame.src = '';
    img.src = '';

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
            img.src = url;
            img.onload = () => {
                loader.classList.add('d-none');
                imgContainer.classList.remove('d-none');
            };
            img.onerror = () => {
                showPreviewError('De afbeelding kon niet worden geladen.');
            };
        } else if (isPDF) {
            if (loaderText) loaderText.textContent = 'PDF voorbereiden...';
            await handlePdfPreview(url, frame, loader, errorDiv);
        } else if (isWord && docContainer) {
            if (loaderText) loaderText.textContent = 'Word-document converteren naar weergave...';
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
            // Unsupported or no preview container available
            showPreviewError('Dit bestandstype kan niet direct worden weergegeven in de browser.');
        }
    } catch (err) {
        console.error('Error during file preview:', err);
        showPreviewError('Er is een fout opgetreden bij het laden van het voorbeeld.');
    }

    return false;
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
 * Handle PDF Preview with Blob or fallback
 */
async function handlePdfPreview(url, frame, loader, errorDiv) {
    try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Kon PDF niet ophalen');
        
        const contentLength = response.headers.get('Content-Length');
        if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
             frame.src = url;
        } else {
             const blob = await response.blob();
             activePreviewBlobUrl = window.URL.createObjectURL(blob);
             frame.src = activePreviewBlobUrl;
        }
        
        frame.onload = function() {
            loader.classList.add('d-none');
            frame.classList.remove('d-none');
        };
    } catch (err) {
        console.error('PDF Preview Fetch Error:', err);
        frame.src = url;
        frame.onload = function() {
            loader.classList.add('d-none');
            frame.classList.remove('d-none');
        };
        frame.onerror = function() {
            showPreviewError('De PDF kon niet worden weergegeven.');
        };
    }
}

/**
 * Symbol & Bullet Mapping Dictionary
 * Maps proprietary Microsoft Symbol and Wingdings font codes to universal Unicode glyphs.
 */
const WORD_SYMBOL_MAP = {
    // Bullets and Common Marks
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
    
    // Checkmarks & Boxes
    0xF0FC: '✓', // Checkmark
    0xF0FD: '✗', // Cross mark
    0xF0FE: '☑', // Checked box
    0xF0FF: '□', // Empty box / checkbox
    
    // Common Wingdings icons
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
    0xF0E0: '✉', // Envelope (very common for email)
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
 * Replaces proprietary Symbol/Wingdings PUA characters with universally recognized Unicode characters.
 */
async function normalizeDocxSymbols(arrayBuffer) {
    if (!window.JSZip) return arrayBuffer;
    try {
        const zip = await window.JSZip.loadAsync(arrayBuffer);
        let modified = false;

        // 1. Process word/numbering.xml (bullet lists & summations)
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

            // Clean bullet levels inside <w:lvl>
            numXml = numXml.replace(/<w:lvl\b[^>]*>[\s\S]*?<\/w:lvl>/gi, (lvlBlock) => {
                let cleaned = lvlBlock;
                // Replace level-2 'o' bullet with '○'
                cleaned = cleaned.replace(/(<w:lvlText\s+[^>]*w:val=\")[oO](\"[^>]*\/>)/g, '$1○$2');
                // Strip w:rFonts in bullet levels so standard system fonts render the bullets cleanly
                if (/w:val=\"bullet\"/i.test(cleaned)) {
                    cleaned = cleaned.replace(/<w:rFonts\b[^>]*\/>/gi, '');
                    cleaned = cleaned.replace(/<w:rFonts\b[^>]*>[\s\S]*?<\/w:rFonts>/gi, '');
                }
                // Strip any proprietary Symbol / Wingdings / Webdings fonts regardless of numFmt
                cleaned = cleaned.replace(/<w:rFonts\b[^>]*(?:Symbol|Wingdings|Webdings)[^>]*\/>/gi, '');
                cleaned = cleaned.replace(/<w:rFonts\b[^>]*(?:Symbol|Wingdings|Webdings)[^>]*>[\s\S]*?<\/w:rFonts>/gi, '');
                return cleaned;
            });

            // Also replace any remaining PUA characters in numbering.xml
            numXml = numXml.replace(/[\uF000-\uF0FF]/g, (ch) => getUnicodeForSymbol(ch.charCodeAt(0)));

            if (numXml !== origNumXml) {
                zip.file('word/numbering.xml', numXml);
                modified = true;
            }
        }

        // 2. Process all text XML files (document.xml, header*.xml, footer*.xml, footnotes.xml, endnotes.xml)
        const xmlFiles = zip.file(/^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/);
        for (const file of xmlFiles) {
            let xml = await file.async('text');
            const origXml = xml;

            // Replace <w:sym w:font="..." w:char="..."/>
            xml = xml.replace(/<w:sym [^>]*w:char=\"([0-9a-fA-F]+)\"[^>]*\/?>/g, (match, hex) => {
                const uni = getUnicodeForSymbol(hex);
                return '<w:t>' + uni + '</w:t>';
            });

            // Replace direct PUA characters from Symbol / Wingdings in document text
            xml = xml.replace(/[\uF000-\uF0FF]/g, (ch) => {
                return getUnicodeForSymbol(ch.charCodeAt(0));
            });

            // Replace entity references &#xf0b7; etc.
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
 * Converts .docx to rich HTML client-side with full layout, marker highlights, recognized bullet symbols, and font colors.
 * Falls back to Mammoth.js and then to server converter if needed.
 */
async function handleWordPreview(url, ext, container, loader) {
    // Check in-memory cache
    if (previewCache.has(url)) {
        container.innerHTML = previewCache.get(url);
        loader.classList.add('d-none');
        container.classList.remove('d-none');
        return;
    }

    // Modern .docx files: render with full layout, marker highlights, and letter colors
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

            // Normalize bullet symbols and Wingdings/Symbol codes to standard recognized Unicode glyphs
            const cleanArrayBuffer = await normalizeDocxSymbols(arrayBuffer);

            container.innerHTML = '';
            const renderWrapper = document.createElement('div');
            renderWrapper.className = 'w-100 h-100';
            container.appendChild(renderWrapper);

            await window.docx.renderAsync(cleanArrayBuffer, renderWrapper, null, {
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
            loader.classList.add('d-none');
            container.classList.remove('d-none');
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

                const markup = `
                    <div class="docx-preview-container p-2 p-md-4">
                        <div class="docx-paper">
                            ${html}
                        </div>
                    </div>
                `;

                previewCache.set(url, markup);
                container.innerHTML = markup;
                loader.classList.add('d-none');
                container.classList.remove('d-none');
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
 * Handle Excel / Spreadsheet (.xlsx, .xls, .csv, .tsv) Preview
 * Converts sheets to responsive HTML tables client-side with SheetJS
 */
async function handleExcelPreview(url, ext, container, loader) {
    // Check in-memory cache
    if (previewCache.has(url)) {
        container.innerHTML = previewCache.get(url);
        loader.classList.add('d-none');
        container.classList.remove('d-none');
        initExcelInteractiveEvents(container);
        return;
    }

    try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Bestand niet bereikbaar');
        const arrayBuffer = await res.arrayBuffer();

        // Lazy-load SheetJS (xlsx.full.min.js)
        await loadVendorScript(
            '/vendor/xlsx.full.min.js',
            'XLSX',
            'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
        );

        const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('Geen werkbladen gevonden in rekenblad.');
        }

        // Store sheet HTMLs
        const sheetMap = {};
        workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const rawTable = window.XLSX.utils.sheet_to_html(worksheet, { id: 'sheetTable' });
            // Enhance table styling with Bootstrap classes
            sheetMap[sheetName] = rawTable.replace('<table', '<table class="sheetjs-table table table-hover table-sm"');
        });

        // Build HTML UI with sheet tabs & search filter
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
        loader.classList.add('d-none');
        container.classList.remove('d-none');

        // Attach tab-switching and filter interactions
        initExcelInteractiveEvents(container, sheetMap);

    } catch (err) {
        console.warn('Client-side Excel preview failed, trying server...', err);
        await handleServerDocPreview(url, container, loader);
    }
}

/**
 * Setup interactions for Excel sheets: tabs and row filtering
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

            // Generate thumbnail buttons
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
            loader.classList.add('d-none');
            container.classList.remove('d-none');

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

            // Render first slide
            await renderCurrentSlide(0);

            // Button handlers
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

            // Keyboard navigation
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

            // Touch swipe gesture navigation
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
                    renderCurrentSlide(currentSlide + 1); // Swipe left = next
                } else if (diff > 50) {
                    renderCurrentSlide(currentSlide - 1); // Swipe right = prev
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
        loader.classList.add('d-none');
        container.classList.remove('d-none');
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

        const markup = `
            <div class="docx-preview-container p-2 p-md-4">
                <div class="docx-paper">
                    ${data.html}
                </div>
            </div>
        `;

        previewCache.set(url, markup);
        container.innerHTML = markup;
        loader.classList.add('d-none');
        container.classList.remove('d-none');
    } catch (serverErr) {
        console.error('Server document conversion failed:', serverErr);
        showPreviewError('Dit bestandstype kan niet direct worden weergegeven in de browser.');
    }
}

/**
 * Display a user-friendly error card inside the preview modal
 */
function showPreviewError(msg) {
    const loader = document.getElementById('previewLoader');
    const errorDiv = document.getElementById('previewError');
    const errorMsg = document.getElementById('previewErrorMessage');
    const frame = document.getElementById('previewFrame');
    const imgContainer = document.getElementById('previewImageContainer');
    const docContainer = document.getElementById('previewDocContainer');

    if (loader) loader.classList.add('d-none');
    if (frame) frame.classList.add('d-none');
    if (imgContainer) imgContainer.classList.add('d-none');
    if (docContainer) docContainer.classList.add('d-none');

    if (errorDiv) {
        if (errorMsg && msg) errorMsg.textContent = msg;
        errorDiv.classList.remove('d-none');
    }
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

    const docContainer = document.getElementById('previewDocContainer');
    if (docContainer) {
        docContainer.innerHTML = '';
        docContainer.classList.add('d-none');
    }
}
