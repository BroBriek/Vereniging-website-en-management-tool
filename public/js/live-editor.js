/**
 * Chiro Meeuwen - Intuitive Live Inline Page Editor
 * Features live in-place text editing and an advanced Image Cropper Modal with rotating, zooming and aspect-ratio tools.
 */
(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', initLiveEditor);

    function initLiveEditor() {
        const toolbar = document.getElementById('live-edit-toolbar');
        const defaultBanner = document.getElementById('live-edit-banner-default');
        const btnToggle = document.getElementById('btn-toggle-edit-mode');
        const btnSave = document.getElementById('btn-save-inline');
        const btnSaveText = document.getElementById('btn-save-text');
        const btnCancel = document.getElementById('btn-cancel-inline');
        const btnClose = document.getElementById('btn-close-edit-mode');
        const dirtyBadge = document.getElementById('live-edit-dirty-badge');
        const canvas = document.querySelector('.scrapbook-canvas') || document.body;

        if (!toolbar && !btnToggle) return; // Not an admin/media user

        // State containers
        const initialState = {};
        const currentState = {};
        let isDirty = false;
        let isEditModeActive = false;

        // Modal & Cropper state
        let cropperInstance = null;
        let activeTargetWrapper = null;
        let scaleX = 1;
        let scaleY = 1;
        let currentAspectRatio = 1; // Default 1:1 for polaroids

        const modalEl = document.getElementById('imageCropperModal');
        const modalInstance = modalEl && typeof bootstrap !== 'undefined' ? new bootstrap.Modal(modalEl) : null;
        const dropzone = document.getElementById('cropper-dropzone');
        const workspace = document.getElementById('cropper-workspace');
        const targetImg = document.getElementById('cropper-target-img');
        const modalFileInput = document.getElementById('modal-file-input');
        const btnBrowse = document.getElementById('btn-browse-file');
        const btnUseCurrent = document.getElementById('btn-use-current');
        const btnChangeFile = document.getElementById('btn-crop-change-file');
        const btnApply = document.getElementById('btn-crop-apply');
        const btnApplyText = document.getElementById('btn-crop-apply-text');

        // CSRF Token helper
        function getCsrfToken() {
            const meta = document.querySelector('meta[name="csrf-token"]');
            return meta ? meta.getAttribute('content') : '';
        }

        // Capture initial state from DOM
        function captureInitialState() {
            // Text elements
            document.querySelectorAll('[data-live-edit][data-live-edit-type="text"]').forEach(el => {
                const key = el.dataset.liveEdit;
                const val = (el.innerText || '').trim();
                initialState[key] = val;
                currentState[key] = val;
            });

            // Rich text elements
            document.querySelectorAll('[data-live-edit][data-live-edit-type="rich"]').forEach(el => {
                const key = el.dataset.liveEdit;
                const val = el.innerHTML.trim();
                initialState[key] = val;
                currentState[key] = val;
            });

            // Images
            document.querySelectorAll('[data-live-edit][data-live-edit-type="image"]').forEach(wrapper => {
                const key = wrapper.dataset.liveEdit;
                const img = wrapper.querySelector('img');
                if (img) {
                    const src = img.getAttribute('src') || '';
                    initialState[key] = src;
                    currentState[key] = src;
                }
            });

            // Button links
            document.querySelectorAll('[data-live-edit-btn]').forEach(el => {
                const textKey = el.dataset.liveEditText;
                const urlKey = el.dataset.liveEditUrl;
                if (textKey) {
                    const textSpan = el.querySelector('.btn-label') || el;
                    const val = (textSpan.innerText || '').trim();
                    initialState[textKey] = val;
                    currentState[textKey] = val;
                }
                if (urlKey) {
                    const val = el.getAttribute('href') || '';
                    initialState[urlKey] = val;
                    currentState[urlKey] = val;
                }
            });
        }

        // Calculate and update dirty status
        function updateDirtyStatus() {
            let changes = 0;
            for (const key in currentState) {
                if (currentState[key] !== initialState[key]) {
                    changes++;
                }
            }

            isDirty = changes > 0;

            if (btnSave) {
                btnSave.disabled = !isDirty;
            }

            if (dirtyBadge) {
                if (isDirty) {
                    dirtyBadge.classList.remove('d-none');
                    dirtyBadge.className = 'badge bg-warning text-dark rounded-pill px-3 py-1 shadow-sm';
                    dirtyBadge.innerHTML = `<i class="bi bi-pencil-fill me-1"></i> ${changes} ${changes === 1 ? 'wijziging' : 'wijzigingen'} niet opgeslagen`;
                } else {
                    dirtyBadge.classList.add('d-none');
                }
            }
        }

        // Floating toast feedback
        function showToast(message, type = 'success') {
            let container = document.getElementById('live-edit-toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'live-edit-toast-container';
                container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
                container.style.zIndex = '1095';
                document.body.appendChild(container);
            }

            const toastEl = document.createElement('div');
            const bgClass = type === 'success' ? 'bg-success text-white' : (type === 'error' ? 'bg-danger text-white' : 'bg-primary text-white');
            const icon = type === 'success' ? 'bi-check-circle-fill' : (type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill');

            toastEl.className = `toast align-items-center ${bgClass} border-0 shadow-lg show`;
            toastEl.setAttribute('role', 'alert');
            toastEl.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body d-flex align-items-center gap-2 fs-6">
                        <i class="bi ${icon} fs-5"></i>
                        <div>${message}</div>
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            `;
            container.appendChild(toastEl);

            const closeBtn = toastEl.querySelector('.btn-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => toastEl.remove());
            }

            setTimeout(() => {
                if (toastEl.parentNode) {
                    toastEl.classList.remove('show');
                    setTimeout(() => toastEl.remove(), 400);
                }
            }, 4000);
        }

        // Toggle Edit Mode ON / OFF
        function setEditMode(active) {
            isEditModeActive = active;

            if (active) {
                canvas.classList.add('live-editing-active');
                if (toolbar) toolbar.classList.remove('d-none');
                if (defaultBanner) defaultBanner.classList.add('d-none');

                enableInlineEditing();

                const url = new URL(window.location.href);
                url.searchParams.set('edit', '1');
                window.history.replaceState({}, '', url.toString());
            } else {
                canvas.classList.remove('live-editing-active');
                if (toolbar) toolbar.classList.add('d-none');
                if (defaultBanner) defaultBanner.classList.remove('d-none');

                disableInlineEditing();

                const url = new URL(window.location.href);
                url.searchParams.delete('edit');
                window.history.replaceState({}, '', url.toString());
            }
        }

        // Enable in-place editing handlers
        function enableInlineEditing() {
            // Text elements
            document.querySelectorAll('[data-live-edit][data-live-edit-type="text"]').forEach(el => {
                el.contentEditable = 'true';
                el.spellcheck = false;
                el.setAttribute('title', 'Klik om tekst aan te passen');

                el.onkeydown = function(e) {
                    if (e.key === 'Enter' && !el.dataset.multiline) {
                        e.preventDefault();
                        el.blur();
                    }
                };

                el.oninput = function() {
                    const key = el.dataset.liveEdit;
                    currentState[key] = (el.innerText || '').trim();
                    updateDirtyStatus();
                };
            });

            // Buttons
            document.querySelectorAll('[data-live-edit-btn]').forEach(el => {
                const textSpan = el.querySelector('.btn-label') || el;
                textSpan.contentEditable = 'true';
                textSpan.spellcheck = false;
                textSpan.setAttribute('title', 'Klik om knoptekst aan te passen');

                textSpan.onkeydown = function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        textSpan.blur();
                    }
                };

                textSpan.oninput = function() {
                    const textKey = el.dataset.liveEditText;
                    if (textKey) {
                        currentState[textKey] = (textSpan.innerText || '').trim();
                        updateDirtyStatus();
                    }
                };

                el.onclick = function(e) {
                    if (isEditModeActive) {
                        if (e.target === el || e.target.classList.contains('btn-url-gear') || e.target.closest('.btn-url-gear')) {
                            e.preventDefault();
                            promptLinkChange(el);
                        }
                    }
                };

                if (!el.querySelector('.btn-url-gear')) {
                    const gear = document.createElement('span');
                    gear.className = 'btn-url-gear ms-2 badge bg-dark bg-opacity-75 rounded-pill';
                    gear.innerHTML = '<i class="bi bi-link-45deg"></i> Link';
                    gear.title = 'Bestemming (URL) van deze knop aanpassen';
                    gear.style.fontSize = '0.75rem';
                    gear.style.cursor = 'pointer';
                    gear.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        promptLinkChange(el);
                    });
                    el.appendChild(gear);
                }
            });

            // Rich text elements (Notebook intro)
            document.querySelectorAll('[data-live-edit][data-live-edit-type="rich"]').forEach(el => {
                el.contentEditable = 'true';
                el.spellcheck = true;
                el.setAttribute('title', 'Klik om het logboek aan te passen');

                setupRichToolbar(el);

                el.oninput = function() {
                    const key = el.dataset.liveEdit;
                    currentState[key] = el.innerHTML.trim();
                    updateDirtyStatus();
                };
            });
        }

        // Disable in-place editing
        function disableInlineEditing() {
            document.querySelectorAll('[data-live-edit][data-live-edit-type="text"], [data-live-edit][data-live-edit-type="rich"]').forEach(el => {
                el.contentEditable = 'false';
                el.removeAttribute('title');
                el.onkeydown = null;
                el.oninput = null;
            });

            document.querySelectorAll('[data-live-edit-btn]').forEach(el => {
                const textSpan = el.querySelector('.btn-label') || el;
                textSpan.contentEditable = 'false';
                textSpan.removeAttribute('title');
                textSpan.onkeydown = null;
                textSpan.oninput = null;
                el.onclick = null;
                const gear = el.querySelector('.btn-url-gear');
                if (gear) gear.remove();
            });

            document.querySelectorAll('.live-rich-toolbar').forEach(el => el.remove());
        }

        // Setup sleek rich text toolbar for notebook
        function setupRichToolbar(richEl) {
            const key = richEl.dataset.liveEdit || 'default';
            const toolbarId = 'live-rich-toolbar-' + key;
            let toolbarEl = document.getElementById(toolbarId);
            if (!toolbarEl) {
                toolbarEl = document.createElement('div');
                toolbarEl.id = toolbarId;
                toolbarEl.className = 'live-rich-toolbar d-flex align-items-center gap-1 p-1 mb-2 bg-white border rounded-pill shadow-sm';
                toolbarEl.innerHTML = `
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="bold" title="Vetgedrukt (Ctrl+B)"><b>B</b></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="italic" title="Cursief (Ctrl+I)"><i>I</i></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="underline" title="Onderstreept (Ctrl+U)"><u>U</u></button>
                    <span class="vr mx-1"></span>
                    <button type="button" class="btn btn-sm btn-light rounded-pill px-2" data-cmd="formatBlock" data-val="h3" title="Kop 3">Kop</button>
                    <button type="button" class="btn btn-sm btn-light rounded-pill px-2" data-cmd="formatBlock" data-val="p" title="Paragraaf">Tekst</button>
                    <span class="vr mx-1"></span>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="insertUnorderedList" title="Opsommingslijst">• Lijst</button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="insertOrderedList" title="Genummerde lijst">1. Lijst</button>
                    <span class="vr mx-1"></span>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="createLink" title="Link toevoegen"><i class="bi bi-link-45deg"></i></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="removeFormat" title="Opmaak wissen"><i class="bi bi-eraser"></i></button>
                `;

                toolbarEl.querySelectorAll('button[data-cmd]').forEach(btn => {
                    btn.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        const cmd = btn.dataset.cmd;
                        const val = btn.dataset.val || null;

                        if (cmd === 'createLink') {
                            const url = prompt('Voer de gewenste weblink in:', 'https://');
                            if (url) document.execCommand(cmd, false, url);
                        } else {
                            document.execCommand(cmd, false, val);
                        }

                        currentState[key] = richEl.innerHTML.trim();
                        updateDirtyStatus();
                    });
                });

                richEl.parentNode.insertBefore(toolbarEl, richEl);
            }
        }

        // Change button link URL
        function promptLinkChange(btnEl) {
            const urlKey = btnEl.dataset.liveEditUrl;
            const currentUrl = currentState[urlKey] || btnEl.getAttribute('href') || '/';
            const newUrl = prompt('Voer de link / bestemming in voor deze knop (bijv. /inschrijven, /leiding, of https://...):', currentUrl);

            if (newUrl !== null && newUrl.trim() !== '') {
                const trimmed = newUrl.trim();
                btnEl.setAttribute('href', trimmed);
                currentState[urlKey] = trimmed;
                updateDirtyStatus();
                showToast(`Knoplink aangepast naar: "${trimmed}"`);
            }
        }

        // =========================================================================
        // ADVANCED IMAGE CROPPER MODAL CONTROLS
        // =========================================================================

        function openCropModal(wrapper) {
            if (!modalInstance) return;

            // Auto-activate edit mode if not already on
            if (!isEditModeActive) {
                setEditMode(true);
            }

            activeTargetWrapper = wrapper;
            scaleX = 1;
            scaleY = 1;

            if (wrapper.dataset.liveEditRatio) {
                const parsed = parseFloat(wrapper.dataset.liveEditRatio);
                currentAspectRatio = isNaN(parsed) ? NaN : parsed;
            } else {
                currentAspectRatio = 1;
            }

            // Sync aspect ratio buttons in modal
            const ratioButtons = document.querySelectorAll('#crop-ratio-group button');
            ratioButtons.forEach(btn => {
                const r = parseFloat(btn.dataset.ratio);
                if ((isNaN(currentAspectRatio) && isNaN(r)) || (Math.abs(r - currentAspectRatio) < 0.05)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            const img = wrapper.querySelector('img');
            const currentSrc = img ? img.getAttribute('src') : '';

            // Check if current image exists and is valid
            if (currentSrc && !currentSrc.startsWith('data:')) {
                loadIntoCropper(currentSrc);
                if (btnUseCurrent) btnUseCurrent.classList.remove('d-none');
            } else {
                showDropzoneView();
                if (btnUseCurrent) btnUseCurrent.classList.add('d-none');
            }

            modalInstance.show();
        }

        function showDropzoneView() {
            if (cropperInstance) {
                cropperInstance.destroy();
                cropperInstance = null;
            }
            if (workspace) workspace.classList.add('d-none');
            if (dropzone) dropzone.classList.remove('d-none');
            if (btnApply) btnApply.disabled = true;
            if (modalFileInput) modalFileInput.value = '';
        }

        function loadIntoCropper(source) {
            if (dropzone) dropzone.classList.add('d-none');
            if (workspace) workspace.classList.remove('d-none');
            if (btnApply) btnApply.disabled = false;

            if (cropperInstance) {
                cropperInstance.destroy();
                cropperInstance = null;
            }

            scaleX = 1;
            scaleY = 1;

            function initCropper() {
                if (typeof Cropper === 'undefined') {
                    console.error('CropperJS library is not loaded');
                    return;
                }
                if (cropperInstance) {
                    cropperInstance.destroy();
                    cropperInstance = null;
                }

                cropperInstance = new Cropper(targetImg, {
                    aspectRatio: currentAspectRatio,
                    viewMode: 1, // Restrict crop box within image
                    dragMode: 'move',
                    autoCropArea: 0.98,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                    responsive: true,
                    ready() {
                        cropperInstance.resize();
                    }
                });
            }

            targetImg.onload = initCropper;
            targetImg.src = source;
            if (targetImg.complete) {
                initCropper();
            }
        }

        function setupCropperModalHandlers() {
            // Browse button
            if (btnBrowse && modalFileInput) {
                btnBrowse.addEventListener('click', () => modalFileInput.click());
            }

            // Dropzone click
            if (dropzone && modalFileInput) {
                dropzone.addEventListener('click', (e) => {
                    if (e.target !== btnBrowse && !btnBrowse.contains(e.target)) {
                        modalFileInput.click();
                    }
                });

                // Dropzone drag-and-drop
                dropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropzone.classList.add('drag-over');
                });
                dropzone.addEventListener('dragleave', () => {
                    dropzone.classList.remove('drag-over');
                });
                dropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('drag-over');
                    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                        handleSelectedFile(file);
                    }
                });
            }

            // File input selection
            if (modalFileInput) {
                modalFileInput.addEventListener('change', (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (file) {
                        handleSelectedFile(file);
                    }
                });
            }

            function handleSelectedFile(file) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    loadIntoCropper(evt.target.result);
                };
                reader.readAsDataURL(file);
            }

            // Change file button inside workspace
            if (btnChangeFile && modalFileInput) {
                btnChangeFile.addEventListener('click', () => {
                    modalFileInput.click();
                });
            }

            // Rotation tools
            const btnRotLeft = document.getElementById('btn-crop-rotate-left');
            const btnRotRight = document.getElementById('btn-crop-rotate-right');
            if (btnRotLeft) {
                btnRotLeft.addEventListener('click', () => {
                    if (cropperInstance) cropperInstance.rotate(-90);
                });
            }
            if (btnRotRight) {
                btnRotRight.addEventListener('click', () => {
                    if (cropperInstance) cropperInstance.rotate(90);
                });
            }

            // Flip tools
            const btnFlipX = document.getElementById('btn-crop-flip-x');
            const btnFlipY = document.getElementById('btn-crop-flip-y');
            if (btnFlipX) {
                btnFlipX.addEventListener('click', () => {
                    if (cropperInstance) {
                        scaleX = -scaleX;
                        cropperInstance.scaleX(scaleX);
                    }
                });
            }
            if (btnFlipY) {
                btnFlipY.addEventListener('click', () => {
                    if (cropperInstance) {
                        scaleY = -scaleY;
                        cropperInstance.scaleY(scaleY);
                    }
                });
            }

            // Zoom tools
            const btnZoomIn = document.getElementById('btn-crop-zoom-in');
            const btnZoomOut = document.getElementById('btn-crop-zoom-out');
            const btnCropReset = document.getElementById('btn-crop-reset');
            if (btnZoomIn) {
                btnZoomIn.addEventListener('click', () => {
                    if (cropperInstance) cropperInstance.zoom(0.1);
                });
            }
            if (btnZoomOut) {
                btnZoomOut.addEventListener('click', () => {
                    if (cropperInstance) cropperInstance.zoom(-0.1);
                });
            }
            if (btnCropReset) {
                btnCropReset.addEventListener('click', () => {
                    if (cropperInstance) {
                        scaleX = 1;
                        scaleY = 1;
                        cropperInstance.reset();
                    }
                });
            }

            // Aspect ratio buttons
            const ratioButtons = document.querySelectorAll('#crop-ratio-group button');
            ratioButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const ratioVal = parseFloat(btn.dataset.ratio);
                    currentAspectRatio = isNaN(ratioVal) ? NaN : ratioVal;

                    ratioButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    if (cropperInstance) {
                        cropperInstance.setAspectRatio(currentAspectRatio);
                    }
                });
            });

            // Cleanup and resize when modal opens/closes
            if (modalEl) {
                modalEl.addEventListener('shown.bs.modal', () => {
                    setTimeout(() => {
                        if (cropperInstance) {
                            cropperInstance.resize();
                        }
                    }, 50);
                });

                modalEl.addEventListener('hidden.bs.modal', () => {
                    if (cropperInstance) {
                        cropperInstance.destroy();
                        cropperInstance = null;
                    }
                });
            }

            // APPLY & UPLOAD CROPPED IMAGE
            if (btnApply) {
                btnApply.addEventListener('click', async () => {
                    if (!cropperInstance || !activeTargetWrapper) return;

                    btnApply.disabled = true;
                    if (btnApplyText) btnApplyText.textContent = 'Bezig met verwerken...';

                    // Get high quality cropped canvas
                    const canvas = cropperInstance.getCroppedCanvas({
                        maxWidth: 1600,
                        maxHeight: 1600,
                        fillColor: '#ffffff',
                        imageSmoothingEnabled: true,
                        imageSmoothingQuality: 'high'
                    });

                    if (!canvas) {
                        showToast('Kon uitsnede niet genereren', 'error');
                        btnApply.disabled = false;
                        if (btnApplyText) btnApplyText.textContent = 'Foto Toepassen';
                        return;
                    }

                    canvas.toBlob(async (blob) => {
                        if (!blob) {
                            showToast('Fout bij het maken van het afbeeldingsbestand', 'error');
                            btnApply.disabled = false;
                            if (btnApplyText) btnApplyText.textContent = 'Foto Toepassen';
                            return;
                        }

                        if (btnApplyText) btnApplyText.textContent = 'Uploaden...';

                        const formData = new FormData();
                        formData.append('image', blob, 'cropped-polaroid-' + Date.now() + '.jpg');
                        formData.append('_csrf', getCsrfToken());

                        try {
                            const response = await fetch('/admin/api/upload-image', {
                                method: 'POST',
                                headers: {
                                    'X-CSRF-Token': getCsrfToken()
                                },
                                body: formData
                            });

                            const result = await response.json();

                            if (response.ok && result && result.url) {
                                // Update image on the homepage
                                const img = activeTargetWrapper.querySelector('img');
                                if (img) img.src = result.url;

                                const key = activeTargetWrapper.dataset.liveEdit;
                                currentState[key] = result.url;
                                currentState[key + '_url'] = result.url;

                                updateDirtyStatus();

                                modalInstance.hide();
                                showToast('Foto succesvol bijgesneden en bijgewerkt! Klik op "Opslaan" om te bewaren.', 'success');
                            } else {
                                throw new Error(result.error || 'Upload mislukt');
                            }
                        } catch (err) {
                            console.error('Upload error:', err);
                            showToast(`Fout bij uploaden: ${err.message}`, 'error');
                        } finally {
                            btnApply.disabled = false;
                            if (btnApplyText) btnApplyText.textContent = 'Foto Toepassen';
                        }
                    }, 'image/jpeg', 0.92);
                });
            }

            // Click listener for all editable polaroid images on page
            document.querySelectorAll('[data-live-edit][data-live-edit-type="image"]').forEach(wrapper => {
                wrapper.addEventListener('click', (e) => {
                    e.preventDefault();
                    openCropModal(wrapper);
                });

                // Drag and drop onto polaroid directly opens modal
                wrapper.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    wrapper.classList.add('live-drop-hover');
                });
                wrapper.addEventListener('dragleave', () => {
                    wrapper.classList.remove('live-drop-hover');
                });
                wrapper.addEventListener('drop', (e) => {
                    e.preventDefault();
                    wrapper.classList.remove('live-drop-hover');
                    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                        openCropModal(wrapper);
                        const reader = new FileReader();
                        reader.onload = function(evt) {
                            loadIntoCropper(evt.target.result);
                        };
                        reader.readAsDataURL(file);
                    }
                });
            });

            // Auto-activate edit mode if admin clicks on any text
            document.querySelectorAll('[data-live-edit][data-live-edit-type="text"], [data-live-edit][data-live-edit-type="rich"]').forEach(el => {
                el.addEventListener('click', () => {
                    if (!isEditModeActive) {
                        setEditMode(true);
                        el.focus();
                    }
                });
            });
        }

        // =========================================================================
        // SAVE & REVERT HANDLERS
        // =========================================================================

        async function savePageChanges() {
            if (!isDirty) return;

            btnSave.disabled = true;
            if (btnSaveText) btnSaveText.textContent = 'Bezig met opslaan...';

            const formData = new FormData();
            formData.append('_csrf', getCsrfToken());
            formData.append('_ajax', '1');

            for (const key in currentState) {
                formData.append(key, currentState[key]);
            }

            const targetSlug = canvas.dataset.pageSlug || document.body.dataset.pageSlug || 'home';

            try {
                const response = await fetch('/admin/page/' + encodeURIComponent(targetSlug), {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'X-CSRF-Token': getCsrfToken()
                    },
                    body: formData
                });

                const data = await response.json().catch(() => ({ success: response.ok }));

                if (response.ok) {
                    Object.assign(initialState, currentState);
                    isDirty = false;
                    updateDirtyStatus();

                    if (btnSaveText) btnSaveText.textContent = 'Opgeslagen!';
                    showToast('Alle wijzigingen zijn succesvol opgeslagen!', 'success');

                    setTimeout(() => {
                        if (btnSaveText) btnSaveText.textContent = 'Opslaan';
                        if (btnSave) btnSave.disabled = !isDirty;
                    }, 2000);
                } else {
                    throw new Error(data.error || data.message || 'Kon pagina niet opslaan');
                }
            } catch (err) {
                console.error('Save page error:', err);
                showToast(`Fout bij het opslaan: ${err.message}`, 'error');
                if (btnSaveText) btnSaveText.textContent = 'Opslaan';
                btnSave.disabled = false;
            }
        }

        function revertChanges() {
            if (!isDirty) return;
            if (!confirm('Weet je zeker dat je alle niet-opgeslagen wijzigingen wilt herstellen?')) {
                return;
            }

            Object.assign(currentState, initialState);

            // Restore text elements
            document.querySelectorAll('[data-live-edit][data-live-edit-type="text"]').forEach(el => {
                const key = el.dataset.liveEdit;
                if (initialState[key] !== undefined) el.innerText = initialState[key];
            });

            // Restore rich text elements
            document.querySelectorAll('[data-live-edit][data-live-edit-type="rich"]').forEach(el => {
                const key = el.dataset.liveEdit;
                if (initialState[key] !== undefined) el.innerHTML = initialState[key];
            });

            // Restore buttons
            document.querySelectorAll('[data-live-edit-btn]').forEach(el => {
                const textKey = el.dataset.liveEditText;
                const urlKey = el.dataset.liveEditUrl;
                if (textKey && initialState[textKey] !== undefined) {
                    const textSpan = el.querySelector('.btn-label') || el;
                    textSpan.innerText = initialState[textKey];
                }
                if (urlKey && initialState[urlKey] !== undefined) {
                    el.setAttribute('href', initialState[urlKey]);
                }
            });

            // Restore images
            document.querySelectorAll('[data-live-edit][data-live-edit-type="image"]').forEach(wrapper => {
                const key = wrapper.dataset.liveEdit;
                const img = wrapper.querySelector('img');
                if (img && initialState[key] !== undefined) {
                    img.src = initialState[key];
                }
            });

            isDirty = false;
            updateDirtyStatus();
            showToast('Alle wijzigingen zijn hersteld.', 'info');
        }

        // Attach Toolbar Listeners
        if (btnToggle) {
            btnToggle.addEventListener('click', () => setEditMode(true));
        }

        if (btnSave) {
            btnSave.addEventListener('click', savePageChanges);
        }

        if (btnCancel) {
            btnCancel.addEventListener('click', revertChanges);
        }

        if (btnClose) {
            btnClose.addEventListener('click', () => {
                if (isDirty) {
                    if (!confirm('Je hebt nog niet-opgeslagen wijzigingen. Weet je zeker dat je de bewerkmodus wilt sluiten zonder op te slaan?')) {
                        return;
                    }
                    revertChanges();
                }
                setEditMode(false);
            });
        }

        // Warn before leaving page if dirty
        window.addEventListener('beforeunload', (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = 'Je hebt nog niet-opgeslagen wijzigingen. Weet je zeker dat je de pagina wilt verlaten?';
                return e.returnValue;
            }
        });

        // Initialize snapshot & cropper controls
        captureInitialState();
        setupCropperModalHandlers();

        // Check query string ?edit=1 or ?edit=true
        const params = new URLSearchParams(window.location.search);
        if (params.get('edit') === '1' || params.get('edit') === 'true') {
            setEditMode(true);
        }

        const successMsg = params.get('success');
        if (successMsg) {
            showToast(decodeURIComponent(successMsg), 'success');
        }
    }
})();
