/**
 * download-helper.js
 * Centralized logic for file downloads and previews
 */

/**
 * Trigger a file download without opening a new tab
 * Uses Blob approach to keep user inside standalone apps when possible
 */
async function triggerDownload(url, filename, btn) {
    if (btn && btn.classList.contains('disabled')) return;

    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    const originalContent = btn ? btn.innerHTML : null;

    // Show loading state if button provided
    if (btn) {
        btn.classList.add('disabled');
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>...';
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) throw new Error('Bestand niet gevonden op de server.');
            throw new Error('Download mislukt (Server Error: ' + response.status + ')');
        }
        
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = filename || 'bestand';
        document.body.appendChild(a);
        a.click();
        
        // Cleanup - Increased timeout to 60 seconds for mobile stability
        // Revoking too fast can cause "Page not found" if the browser navigates to the blob instead of downloading
        setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
            if (a.parentNode) {
                document.body.removeChild(a);
            }
        }, 60000);

    } catch (e) {
        console.error('Download error:', e);
        
        // Alert the user so they know why it might navigate
        alert('Download kon niet direct worden gestart: ' + e.message + '\n\nWe proberen het nu op de standaard manier.');

        // Fallback: standard navigation
        // For standalone apps, we use _blank to try and force a system browser pop-out
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

// Keep track of active blob URLs to clean up
let activePreviewBlobUrl = null;

/**
 * Open a file in the shared preview modal
 */
async function openFilePreview(url, name) {
    const modalEl = document.getElementById('filePreviewModal');
    if (!modalEl) {
        console.warn('filePreviewModal not found, navigating directly to:', url);
        window.location.href = url;
        return false;
    }

    const modal = new bootstrap.Modal(modalEl);
    const frame = document.getElementById('previewFrame');
    const imgContainer = document.getElementById('previewImageContainer');
    const img = document.getElementById('previewImage');
    const title = document.getElementById('previewFileName');
    const downloadBtn = document.getElementById('previewDownloadBtn');
    const errorBtn = document.getElementById('previewErrorDownloadBtn');
    const loader = document.getElementById('previewLoader');
    const errorDiv = document.getElementById('previewError');
    
    if (!frame || !img || !title || !downloadBtn) {
        console.error('Required preview modal elements missing');
        return false;
    }

    // Cleanup previous blob URL if exists
    if (activePreviewBlobUrl) {
        window.URL.revokeObjectURL(activePreviewBlobUrl);
        activePreviewBlobUrl = null;
    }

    // Standalone check
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

    // Reset state
    title.textContent = name;
    const downloadUrl = `/download?path=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
    
    // Set href and attributes
    downloadBtn.href = downloadUrl;
    if (errorBtn) errorBtn.href = downloadUrl;
    
    // In standalone mode, we try to open in new window to trigger system browser pop-out if it fails internally
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

    // Add click event for better control
    const downloadHandler = (e) => {
        e.preventDefault();
        triggerDownload(downloadUrl, name, e.currentTarget);
    };
    
    downloadBtn.onclick = downloadHandler;
    if (errorBtn) errorBtn.onclick = downloadHandler;
    
    loader.classList.remove('d-none');
    frame.classList.add('d-none'); 
    imgContainer.classList.add('d-none');
    errorDiv.classList.add('d-none');
    frame.src = '';
    img.src = '';

    // Determine type
    const ext = name.split('.').pop().toLowerCase();
    const isPDF = ext === 'pdf';
    const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

    if (isImage) {
        img.src = url;
        img.onload = function() {
            loader.classList.add('d-none');
            imgContainer.classList.remove('d-none');
        };
        img.onerror = function() {
            loader.classList.add('d-none');
            errorDiv.classList.remove('d-none');
        };
    } else if (isPDF) {
        try {
            // Use Fetch/Blob system for PDF preview too
            const response = await fetch(url);
            if (!response.ok) throw new Error('Kon PDF niet ophalen');
            
            const blob = await response.blob();
            activePreviewBlobUrl = window.URL.createObjectURL(blob);
            
            frame.src = activePreviewBlobUrl;
            frame.onload = function() {
                loader.classList.add('d-none');
                frame.classList.remove('d-none');
            };
        } catch (err) {
            console.error('PDF Preview Error:', err);
            // Fallback to direct URL if fetch fails
            frame.src = url;
            frame.onload = function() {
                loader.classList.add('d-none');
                frame.classList.remove('d-none');
            };
            frame.onerror = function() {
                 loader.classList.add('d-none');
                 errorDiv.classList.remove('d-none');
            };
        }
    } else if (isOffice) {
        // Check if localhost/local IP
        const isLocal = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' || 
                        window.location.hostname.startsWith('192.168.') ||
                        window.location.hostname.endsWith('.local');

        if (isLocal) {
             loader.classList.add('d-none');
             errorDiv.classList.remove('d-none');
             const p = errorDiv.querySelector('p');
             if (p) p.textContent = "Office bestanden kunnen niet lokaal worden bekeken (Google Docs Viewer vereist een publieke URL).";
        } else {
             // Use Google Docs Viewer
             const encodedUrl = encodeURIComponent(window.location.origin + url);
             frame.src = `https://docs.google.com/gview?url=${encodedUrl}&embedded=true`;
             frame.onload = function() {
                loader.classList.add('d-none');
                frame.classList.remove('d-none');
             };
        }
    } else {
        // Unknown type
         loader.classList.add('d-none');
         errorDiv.classList.remove('d-none');
    }

    modal.show();
    
    // Add event listener to cleanup blob URL when modal is hidden
    modalEl.addEventListener('hidden.bs.modal', function handler() {
        if (activePreviewBlobUrl) {
            window.URL.revokeObjectURL(activePreviewBlobUrl);
            activePreviewBlobUrl = null;
        }
        modalEl.removeEventListener('hidden.bs.modal', handler);
    });

    return false; // Prevent default link click
}
