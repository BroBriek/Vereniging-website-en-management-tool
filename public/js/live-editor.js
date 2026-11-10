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
                const val = (el.innerHTML || '').trim();
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

            // Toggle elements (switches)
            document.querySelectorAll('[data-live-edit-toggle]').forEach(el => {
                const key = el.dataset.liveEditToggle;
                const val = el.checked ? '1' : '0';
                initialState[key] = val;
                currentState[key] = val;
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

        // Selection & Active Element Tracking for Rich / Inline Text Formatting
        const savedRanges = new WeakMap();
        let activeTextElement = null;
        let floatingTextToolbar = null;

        const TEXT_COLOR_SWATCHES = [
            { color: '#1e293b', label: 'Donker (Standaard)' },
            { color: '#db3e41', label: 'Chiro Rood' },
            { color: '#1d4ed8', label: 'Chiro Blauw' },
            { color: '#d97706', label: 'Chiro Geel / Oker' },
            { color: '#15803d', label: 'Bosgroen' },
            { color: '#16a34a', label: 'Heldergroen' },
            { color: '#0284c7', label: 'Hemelsblauw' },
            { color: '#7e22ce', label: 'Paars' },
            { color: '#db2777', label: 'Roze' },
            { color: '#ea580c', label: 'Oranje' },
            { color: '#78350f', label: 'Bruin' },
            { color: '#64748b', label: 'Grijs' },
            { color: '#000000', label: 'Zwart' },
            { color: '#ffffff', label: 'Wit' }
        ];

        const HIGHLIGHT_COLOR_SWATCHES = [
            { color: '#fef08a', label: 'Geel markeren' },
            { color: '#bbf7d0', label: 'Groen markeren' },
            { color: '#bfdbfe', label: 'Blauw markeren' },
            { color: '#fecdd3', label: 'Roze / Rood markeren' },
            { color: '#fed7aa', label: 'Oranje markeren' },
            { color: '#e9d5ff', label: 'Paars markeren' },
            { color: '#f1f5f9', label: 'Lichtgrijs markeren' },
            { color: '#db3e41', label: 'Donkerrood achtergrond' },
            { color: '#1d4ed8', label: 'Donkerblauw achtergrond' }
        ];

        const FONT_SIZE_MAP = {
            '1': '0.8rem',
            '2': '0.9rem',
            '3': '1rem',
            '4': '1.15rem',
            '5': '1.35rem',
            '6': '1.65rem',
            '7': '2.1rem'
        };

        function saveSelectionFor(el) {
            if (!el) return;
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (el.contains(range.commonAncestorContainer) || el === range.commonAncestorContainer) {
                    savedRanges.set(el, range.cloneRange());
                }
            }
        }

        function restoreSelectionFor(el, selectAllIfCollapsed = false) {
            if (!el) return;
            el.focus();
            const sel = window.getSelection();
            if (!sel) return;

            const saved = savedRanges.get(el);
            if (saved) {
                sel.removeAllRanges();
                sel.addRange(saved);
            }

            if (selectAllIfCollapsed && sel.rangeCount > 0 && sel.getRangeAt(0).collapsed) {
                const range = document.createRange();
                range.selectNodeContents(el);
                sel.removeAllRanges();
                sel.addRange(range);
                savedRanges.set(el, range.cloneRange());
            }
        }

        function syncEditableState(el) {
            if (!el || !el.dataset.liveEdit) return;
            const key = el.dataset.liveEdit;
            currentState[key] = (el.innerHTML || '').trim();
            updateDirtyStatus();
        }

        function clearInlineStyleProperty(el, propName) {
            if (!el) return;
            const isTextEl = el.dataset.liveEditType === 'text';
            restoreSelectionFor(el, isTextEl);

            const sel = window.getSelection();
            const clearNodeStyles = (root) => {
                root.querySelectorAll('*').forEach(node => {
                    if (node.style && node.style[propName]) {
                        node.style[propName] = '';
                        if (!node.getAttribute('style') || node.getAttribute('style').trim() === '') {
                            node.removeAttribute('style');
                        }
                    }
                    if (propName === 'color' && node.tagName === 'FONT' && node.hasAttribute('color')) {
                        node.removeAttribute('color');
                    }
                });
            };

            if (!sel || sel.rangeCount === 0 || sel.getRangeAt(0).collapsed) {
                clearNodeStyles(el);
            } else {
                const range = sel.getRangeAt(0);
                const container = range.commonAncestorContainer.nodeType === 1
                    ? range.commonAncestorContainer
                    : range.commonAncestorContainer.parentElement;
                if (container && el.contains(container)) {
                    if (container !== el) {
                        if (container.style && container.style[propName]) {
                            container.style[propName] = '';
                            if (!container.getAttribute('style') || container.getAttribute('style').trim() === '') {
                                container.removeAttribute('style');
                            }
                        }
                        if (propName === 'color' && container.tagName === 'FONT') {
                            container.removeAttribute('color');
                        }
                    }
                    clearNodeStyles(container);
                } else {
                    clearNodeStyles(el);
                }
            }
            syncEditableState(el);
        }

        function applyFontSize(el, sizeKey) {
            if (!el || !sizeKey) return;
            const isTextEl = el.dataset.liveEditType === 'text';
            restoreSelectionFor(el, isTextEl);

            document.execCommand('styleWithCSS', false, false);
            document.execCommand('fontSize', false, sizeKey);

            const cssSize = FONT_SIZE_MAP[sizeKey] || '1rem';
            el.querySelectorAll(`font[size="${sizeKey}"]`).forEach(fontEl => {
                const span = document.createElement('span');
                span.style.fontSize = cssSize;
                span.innerHTML = fontEl.innerHTML;
                fontEl.parentNode.replaceChild(span, fontEl);
            });

            saveSelectionFor(el);
            syncEditableState(el);
        }

        function executeEditorCommand(el, cmd, val = null) {
            if (!el) return;
            const isTextEl = el.dataset.liveEditType === 'text';
            const selectAllWhenCollapsed = isTextEl && ['foreColor', 'hiliteColor', 'backColor', 'bold', 'italic', 'underline', 'strikeThrough', 'removeFormat'].includes(cmd);

            restoreSelectionFor(el, selectAllWhenCollapsed);

            if (cmd === 'createLink') {
                const sel = window.getSelection();
                let existingHref = 'https://';
                if (sel && sel.anchorNode) {
                    const anchor = (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest('a');
                    if (anchor && anchor.getAttribute('href')) {
                        existingHref = anchor.getAttribute('href');
                    }
                }
                const url = prompt('Voer de gewenste weblink in (bijv. https://... of /inschrijven):', existingHref);
                if (url && url.trim() !== '') {
                    restoreSelectionFor(el, isTextEl);
                    document.execCommand('createLink', false, url.trim());
                }
            } else if (cmd === 'formatBlock') {
                document.execCommand('styleWithCSS', false, false);
                const tag = val && val.startsWith('<') ? val : `<${val}>`;
                document.execCommand('formatBlock', false, tag);
            } else if (cmd === 'foreColor' || cmd === 'hiliteColor' || cmd === 'backColor') {
                document.execCommand('styleWithCSS', false, true);
                if (cmd === 'hiliteColor') {
                    if (!document.execCommand('hiliteColor', false, val)) {
                        document.execCommand('backColor', false, val);
                    }
                } else {
                    document.execCommand(cmd, false, val);
                }
            } else if (cmd === 'removeFormat') {
                document.execCommand('removeFormat', false, null);
                clearInlineStyleProperty(el, 'color');
                clearInlineStyleProperty(el, 'backgroundColor');
                clearInlineStyleProperty(el, 'fontSize');
            } else {
                document.execCommand('styleWithCSS', false, false);
                document.execCommand(cmd, false, val);
            }

            saveSelectionFor(el);
            syncEditableState(el);
            updateToolbarActiveStates(el);
        }

        function closeAllToolbarPopovers(exceptPopover = null) {
            document.querySelectorAll('.live-toolbar-popover.show').forEach(pop => {
                if (pop !== exceptPopover) {
                    pop.classList.remove('show');
                }
            });
        }

        document.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.live-toolbar-dropdown')) {
                closeAllToolbarPopovers();
            }
            if (floatingTextToolbar && !floatingTextToolbar.contains(e.target) && !e.target.closest('[data-live-edit][data-live-edit-type="text"]')) {
                floatingTextToolbar.classList.add('d-none');
            }
        });

        function buildToolbarHTML(mode = 'rich') {
            const isRich = mode === 'rich';

            const textColorSwatchesHtml = TEXT_COLOR_SWATCHES.map(s => `
                <button type="button" class="live-color-swatch" data-color-cmd="foreColor" data-color-val="${s.color}" title="${s.label}" style="background-color: ${s.color}; ${s.color === '#ffffff' ? 'border: 1px solid #cbd5e1;' : ''}"></button>
            `).join('');

            const highlightSwatchesHtml = HIGHLIGHT_COLOR_SWATCHES.map(s => `
                <button type="button" class="live-color-swatch" data-color-cmd="hiliteColor" data-color-val="${s.color}" title="${s.label}" style="background-color: ${s.color};"></button>
            `).join('');

            return `
                <!-- Undo / Redo -->
                <div class="d-inline-flex align-items-center gap-1">
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="undo" title="Ongedaan maken (Ctrl+Z)"><i class="bi bi-arrow-counterclockwise"></i></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="redo" title="Opnieuw (Ctrl+Y)"><i class="bi bi-arrow-clockwise"></i></button>
                </div>
                <span class="vr mx-1"></span>

                ${isRich ? `
                <!-- Block Format (Headings / Paragraph / Quote) -->
                <select class="form-select form-select-sm live-toolbar-select" data-select-cmd="formatBlock" title="Tekststijl / Koptekst" aria-label="Tekststijl">
                    <option value="p">Tekst (Paragraaf)</option>
                    <option value="h1">Kop 1 (Groot)</option>
                    <option value="h2">Kop 2 (Middel)</option>
                    <option value="h3">Kop 3 (Subkop)</option>
                    <option value="h4">Kop 4 (Klein)</option>
                    <option value="blockquote">Citaatblok</option>
                </select>
                ` : ''}

                <!-- Font Size -->
                <select class="form-select form-select-sm live-toolbar-select" data-select-cmd="fontSize" title="Tekstgrootte" aria-label="Tekstgrootte">
                    <option value="" selected disabled>Grootte</option>
                    <option value="2">Klein</option>
                    <option value="3">Normaal</option>
                    <option value="4">Medium</option>
                    <option value="5">Groot</option>
                    <option value="6">Extra groot</option>
                </select>
                <span class="vr mx-1"></span>

                <!-- Basic Formatting -->
                <div class="d-inline-flex align-items-center gap-1">
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="bold" title="Vetgedrukt (Ctrl+B)"><i class="bi bi-type-bold"></i></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="italic" title="Cursief (Ctrl+I)"><i class="bi bi-type-italic"></i></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="underline" title="Onderstreept (Ctrl+U)"><i class="bi bi-type-underline"></i></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="strikeThrough" title="Doorstreept"><i class="bi bi-type-strikethrough"></i></button>
                </div>
                <span class="vr mx-1"></span>

                <!-- Text Color & Highlight Color -->
                <div class="d-inline-flex align-items-center gap-1">
                    <!-- Text Color Dropdown -->
                    <div class="live-toolbar-dropdown position-relative">
                        <button type="button" class="btn btn-sm btn-light rounded-pill px-2 d-inline-flex align-items-center gap-1" data-toggle-popover="foreColor" title="Tekstkleur aanpassen">
                            <span class="fw-bold d-inline-flex flex-column align-items-center lh-1" style="font-size: 0.85rem;">
                                A
                                <span class="live-color-indicator" data-indicator="foreColor" style="background-color: #db3e41;"></span>
                            </span>
                            <i class="bi bi-chevron-down" style="font-size: 0.65rem;"></i>
                        </button>
                        <div class="live-toolbar-popover shadow-lg border rounded-4 p-2 bg-white">
                            <div class="small fw-bold text-muted mb-1 px-1">Tekstkleur</div>
                            <div class="live-color-grid mb-2">
                                ${textColorSwatchesHtml}
                            </div>
                            <div class="d-flex align-items-center justify-content-between gap-2 pt-1 border-top">
                                <label class="small text-muted mb-0 d-flex align-items-center gap-1" style="cursor: pointer;" title="Kies een eigen kleur">
                                    <input type="color" class="form-control form-control-color form-control-sm p-0 border-0" data-custom-color="foreColor" value="#db3e41" style="width: 24px; height: 24px;">
                                    <span>Eigen kleur</span>
                                </label>
                                <button type="button" class="btn btn-link btn-sm text-secondary text-decoration-none p-0 small" data-clear-style="color" title="Standaard tekstkleur herstellen">
                                    <i class="bi bi-arrow-counterclockwise"></i> Standaard
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Highlight / Background Color Dropdown -->
                    <div class="live-toolbar-dropdown position-relative">
                        <button type="button" class="btn btn-sm btn-light rounded-pill px-2 d-inline-flex align-items-center gap-1" data-toggle-popover="hiliteColor" title="Markeerkleur / Achtergrondkleur">
                            <span class="d-inline-flex flex-column align-items-center lh-1" style="font-size: 0.85rem;">
                                <i class="bi bi-highlighter"></i>
                                <span class="live-color-indicator" data-indicator="hiliteColor" style="background-color: #fef08a;"></span>
                            </span>
                            <i class="bi bi-chevron-down" style="font-size: 0.65rem;"></i>
                        </button>
                        <div class="live-toolbar-popover shadow-lg border rounded-4 p-2 bg-white">
                            <div class="small fw-bold text-muted mb-1 px-1">Markeerkleur</div>
                            <div class="live-color-grid mb-2">
                                ${highlightSwatchesHtml}
                            </div>
                            <div class="d-flex align-items-center justify-content-between gap-2 pt-1 border-top">
                                <label class="small text-muted mb-0 d-flex align-items-center gap-1" style="cursor: pointer;" title="Kies een eigen markeerkleur">
                                    <input type="color" class="form-control form-control-color form-control-sm p-0 border-0" data-custom-color="hiliteColor" value="#fef08a" style="width: 24px; height: 24px;">
                                    <span>Eigen kleur</span>
                                </label>
                                <button type="button" class="btn btn-link btn-sm text-secondary text-decoration-none p-0 small" data-clear-style="backgroundColor" title="Markering wissen">
                                    <i class="bi bi-x-circle"></i> Geen
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <span class="vr mx-1"></span>

                <!-- Alignment -->
                <div class="d-inline-flex align-items-center gap-1">
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="justifyLeft" title="Links uitlijnen"><i class="bi bi-text-left"></i></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="justifyCenter" title="Centreren"><i class="bi bi-text-center"></i></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="justifyRight" title="Rechts uitlijnen"><i class="bi bi-text-right"></i></button>
                    ${isRich ? `<button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="justifyFull" title="Uitvullen"><i class="bi bi-justify"></i></button>` : ''}
                </div>
                <span class="vr mx-1"></span>

                ${isRich ? `
                <!-- Lists & Indentation -->
                <div class="d-inline-flex align-items-center gap-1">
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="insertUnorderedList" title="Opsommingslijst"><i class="bi bi-list-ul"></i></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="insertOrderedList" title="Genummerde lijst"><i class="bi bi-list-ol"></i></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="outdent" title="Inspringing verkleinen"><i class="bi bi-text-indent-right"></i></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="indent" title="Inspringing vergroten"><i class="bi bi-text-indent-left"></i></button>
                </div>
                <span class="vr mx-1"></span>
                ` : ''}

                <!-- Links, Media & Clear Format -->
                <div class="d-inline-flex align-items-center gap-1">
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="createLink" title="Link toevoegen of aanpassen"><i class="bi bi-link-45deg"></i></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="unlink" title="Link verwijderen"><i class="bi bi-link"></i></button>
                    ${isRich ? `
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-action="insertImage" title="Afbeelding in tekst invoegen"><i class="bi bi-image"></i></button>
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2" data-cmd="insertHorizontalRule" title="Scheidingslijn invoegen"><i class="bi bi-hr"></i></button>
                    ` : ''}
                    <button type="button" class="btn btn-sm btn-light rounded-circle px-2 text-danger" data-cmd="removeFormat" title="Alle opmaak wissen"><i class="bi bi-eraser"></i></button>
                </div>
            `;
        }

        function bindToolbarEvents(toolbarEl, getTargetEl) {
            // Standard command buttons
            toolbarEl.querySelectorAll('button[data-cmd]').forEach(btn => {
                btn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const targetEl = getTargetEl();
                    if (!targetEl) return;
                    const cmd = btn.dataset.cmd;
                    const val = btn.dataset.val || null;
                    executeEditorCommand(targetEl, cmd, val);
                });
            });

            // Dropdown selects (formatBlock, fontSize)
            toolbarEl.querySelectorAll('select[data-select-cmd]').forEach(selectEl => {
                selectEl.addEventListener('mousedown', () => {
                    const targetEl = getTargetEl();
                    if (targetEl) saveSelectionFor(targetEl);
                });
                selectEl.addEventListener('change', () => {
                    const targetEl = getTargetEl();
                    if (!targetEl) return;
                    const cmd = selectEl.dataset.selectCmd;
                    const val = selectEl.value;
                    if (cmd === 'fontSize') {
                        applyFontSize(targetEl, val);
                        selectEl.selectedIndex = 0;
                    } else if (cmd === 'formatBlock') {
                        executeEditorCommand(targetEl, 'formatBlock', val);
                    }
                });
            });

            // Popover toggles (Text Color & Highlight Color)
            toolbarEl.querySelectorAll('button[data-toggle-popover]').forEach(btn => {
                btn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetEl = getTargetEl();
                    if (targetEl) saveSelectionFor(targetEl);

                    const dropdown = btn.closest('.live-toolbar-dropdown');
                    const popover = dropdown ? dropdown.querySelector('.live-toolbar-popover') : null;
                    if (popover) {
                        const willShow = !popover.classList.contains('show');
                        closeAllToolbarPopovers(popover);
                        popover.classList.toggle('show', willShow);
                    }
                });
            });

            // Color swatches
            toolbarEl.querySelectorAll('button[data-color-cmd]').forEach(swatch => {
                swatch.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetEl = getTargetEl();
                    if (!targetEl) return;

                    const cmd = swatch.dataset.colorCmd;
                    const color = swatch.dataset.colorVal;
                    executeEditorCommand(targetEl, cmd, color);

                    const indicator = toolbarEl.querySelector(`[data-indicator="${cmd}"]`);
                    if (indicator) indicator.style.backgroundColor = color;

                    closeAllToolbarPopovers();
                });
            });

            // Custom color inputs
            toolbarEl.querySelectorAll('input[data-custom-color]').forEach(colorInput => {
                colorInput.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    const targetEl = getTargetEl();
                    if (targetEl) saveSelectionFor(targetEl);
                });
                colorInput.addEventListener('input', () => {
                    const targetEl = getTargetEl();
                    if (!targetEl) return;
                    const cmd = colorInput.dataset.customColor;
                    const color = colorInput.value;
                    executeEditorCommand(targetEl, cmd, color);

                    const indicator = toolbarEl.querySelector(`[data-indicator="${cmd}"]`);
                    if (indicator) indicator.style.backgroundColor = color;
                });
                colorInput.addEventListener('change', () => {
                    closeAllToolbarPopovers();
                });
            });

            // Clear specific style (reset color / reset highlight)
            toolbarEl.querySelectorAll('button[data-clear-style]').forEach(clearBtn => {
                clearBtn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetEl = getTargetEl();
                    if (!targetEl) return;
                    const prop = clearBtn.dataset.clearStyle;
                    clearInlineStyleProperty(targetEl, prop);
                    closeAllToolbarPopovers();
                });
            });

            // Inline image upload inside rich text
            const imgBtn = toolbarEl.querySelector('button[data-action="insertImage"]');
            if (imgBtn) {
                const inlineFileInput = document.createElement('input');
                inlineFileInput.type = 'file';
                inlineFileInput.accept = 'image/*';
                inlineFileInput.className = 'd-none';
                toolbarEl.appendChild(inlineFileInput);

                imgBtn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const targetEl = getTargetEl();
                    if (targetEl) saveSelectionFor(targetEl);
                    inlineFileInput.click();
                });

                inlineFileInput.addEventListener('change', async () => {
                    const file = inlineFileInput.files && inlineFileInput.files[0];
                    inlineFileInput.value = '';
                    if (!file) return;

                    const targetEl = getTargetEl();
                    if (!targetEl) return;

                    const formData = new FormData();
                    formData.append('image', file);
                    formData.append('_csrf', getCsrfToken());

                    try {
                        showToast('Afbeelding uploaden...', 'info');
                        const response = await fetch('/admin/api/upload-image', {
                            method: 'POST',
                            headers: { 'X-CSRF-Token': getCsrfToken() },
                            body: formData
                        });
                        const data = await response.json();
                        if (response.ok && data && data.url) {
                            restoreSelectionFor(targetEl);
                            document.execCommand('insertImage', false, data.url);
                            targetEl.querySelectorAll(`img[src="${data.url}"]`).forEach(img => {
                                img.classList.add('img-fluid', 'rounded-3', 'my-2', 'shadow-sm');
                            });
                            saveSelectionFor(targetEl);
                            syncEditableState(targetEl);
                            showToast('Afbeelding ingevoegd in de tekst!', 'success');
                        } else {
                            throw new Error(data.error || 'Upload mislukt');
                        }
                    } catch (err) {
                        console.error('Inline image upload error:', err);
                        showToast(`Kon afbeelding niet uploaden: ${err.message}`, 'error');
                    }
                });
            }
        }

        function updateToolbarActiveStates(el) {
            if (!el) return;
            const key = el.dataset.liveEdit || 'default';
            const toolbarEl = el.dataset.liveEditType === 'rich'
                ? document.getElementById('live-rich-toolbar-' + key)
                : floatingTextToolbar;
            if (!toolbarEl) return;

            ['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'insertUnorderedList', 'insertOrderedList'].forEach(cmd => {
                const btn = toolbarEl.querySelector(`button[data-cmd="${cmd}"]`);
                if (btn) {
                    try {
                        const active = document.queryCommandState(cmd);
                        btn.classList.toggle('active', active);
                        btn.classList.toggle('btn-primary', active);
                        btn.classList.toggle('text-white', active);
                        btn.classList.toggle('btn-light', !active);
                    } catch (e) {}
                }
            });

            const blockSelect = toolbarEl.querySelector('select[data-select-cmd="formatBlock"]');
            if (blockSelect) {
                try {
                    const blockVal = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
                    if (['p', 'h1', 'h2', 'h3', 'h4', 'blockquote'].includes(blockVal)) {
                        blockSelect.value = blockVal;
                    } else {
                        blockSelect.value = 'p';
                    }
                } catch (e) {}
            }
        }

        function ensureFloatingTextToolbar() {
            if (floatingTextToolbar) return floatingTextToolbar;
            floatingTextToolbar = document.createElement('div');
            floatingTextToolbar.id = 'live-floating-text-toolbar';
            floatingTextToolbar.className = 'live-rich-toolbar live-floating-text-toolbar d-none d-flex flex-wrap align-items-center gap-1 p-1 bg-white border rounded-4 shadow';
            floatingTextToolbar.innerHTML = buildToolbarHTML('text');
            document.body.appendChild(floatingTextToolbar);
            bindToolbarEvents(floatingTextToolbar, () => activeTextElement);
            return floatingTextToolbar;
        }

        function positionFloatingTextToolbar(targetEl) {
            const tb = ensureFloatingTextToolbar();
            tb.classList.remove('d-none');

            const rect = targetEl.getBoundingClientRect();
            const tbRect = tb.getBoundingClientRect();
            const top = Math.max(70, rect.top + window.scrollY - (tbRect.height || 44) - 8);
            let left = rect.left + window.scrollX;
            const maxLeft = window.scrollX + document.documentElement.clientWidth - (tbRect.width || 420) - 12;
            left = Math.max(12, Math.min(left, maxLeft));

            tb.style.top = `${top}px`;
            tb.style.left = `${left}px`;
        }

        // Enable in-place editing handlers
        function enableInlineEditing() {
            ensureFloatingTextToolbar();

            // Text elements
            document.querySelectorAll('[data-live-edit][data-live-edit-type="text"]').forEach(el => {
                el.contentEditable = 'true';
                el.spellcheck = false;
                el.setAttribute('title', 'Klik om tekst en opmaak (zoals kleur) aan te passen');

                el.onfocus = function() {
                    activeTextElement = el;
                    saveSelectionFor(el);
                    positionFloatingTextToolbar(el);
                    updateToolbarActiveStates(el);
                };

                el.onmouseup = function() {
                    activeTextElement = el;
                    saveSelectionFor(el);
                    updateToolbarActiveStates(el);
                };

                el.onkeyup = function() {
                    activeTextElement = el;
                    saveSelectionFor(el);
                    updateToolbarActiveStates(el);
                };

                el.onkeydown = function(e) {
                    if (e.key === 'Enter' && !el.dataset.multiline) {
                        e.preventDefault();
                        el.blur();
                    }
                };

                el.oninput = function() {
                    saveSelectionFor(el);
                    syncEditableState(el);
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

            // Rich text elements (Notebook intro & main sections)
            document.querySelectorAll('[data-live-edit][data-live-edit-type="rich"]').forEach(el => {
                el.contentEditable = 'true';
                el.spellcheck = true;
                el.setAttribute('title', 'Klik om de tekst en opmaak aan te passen');

                setupRichToolbar(el);

                el.onfocus = function() {
                    if (floatingTextToolbar) floatingTextToolbar.classList.add('d-none');
                    saveSelectionFor(el);
                    updateToolbarActiveStates(el);
                };

                el.onmouseup = function() {
                    saveSelectionFor(el);
                    updateToolbarActiveStates(el);
                };

                el.onkeyup = function() {
                    saveSelectionFor(el);
                    updateToolbarActiveStates(el);
                };

                el.oninput = function() {
                    saveSelectionFor(el);
                    syncEditableState(el);
                };
            });

            // Toggle elements (switches)
            document.querySelectorAll('[data-live-edit-toggle]').forEach(el => {
                el.onchange = function() {
                    const key = el.dataset.liveEditToggle;
                    const val = el.checked ? '1' : '0';
                    currentState[key] = val;
                    syncToggleVisuals(key, el.checked);
                    updateDirtyStatus();
                };
            });
        }

        // Disable in-place editing
        function disableInlineEditing() {
            document.querySelectorAll('[data-live-edit][data-live-edit-type="text"], [data-live-edit][data-live-edit-type="rich"]').forEach(el => {
                el.contentEditable = 'false';
                el.removeAttribute('title');
                el.onfocus = null;
                el.onmouseup = null;
                el.onkeyup = null;
                el.onkeydown = null;
                el.oninput = null;
            });

            document.querySelectorAll('[data-live-edit-toggle]').forEach(el => {
                el.onchange = null;
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
            floatingTextToolbar = null;
            activeTextElement = null;
        }

        // Setup comprehensive rich text toolbar for notebook / rich content blocks
        function setupRichToolbar(richEl) {
            const key = richEl.dataset.liveEdit || 'default';
            const toolbarId = 'live-rich-toolbar-' + key;
            let toolbarEl = document.getElementById(toolbarId);
            if (!toolbarEl) {
                toolbarEl = document.createElement('div');
                toolbarEl.id = toolbarId;
                toolbarEl.className = 'live-rich-toolbar d-flex flex-wrap align-items-center gap-1 p-2 mb-3 bg-white border rounded-4 shadow-sm';
                toolbarEl.innerHTML = buildToolbarHTML('rich');
                bindToolbarEvents(toolbarEl, () => richEl);
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
                if (initialState[key] !== undefined) el.innerHTML = initialState[key];
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

            // Restore toggles
            document.querySelectorAll('[data-live-edit-toggle]').forEach(el => {
                const key = el.dataset.liveEditToggle;
                if (initialState[key] !== undefined) {
                    el.checked = (initialState[key] === '1');
                    syncToggleVisuals(key, el.checked);
                }
            });

            isDirty = false;
            updateDirtyStatus();
            showToast('Alle wijzigingen zijn hersteld.', 'info');
        }

        function syncToggleVisuals(key, isChecked) {
            if (key === 'show_dept_photos') {
                const label = document.getElementById('toggle-dept-photos-label');
                if (label) {
                    label.textContent = isChecked ? "Groepen Zichtbaar" : "Groepen Verborgen";
                }
                const toolbarText = document.getElementById('toolbar-dept-photos-text');
                if (toolbarText) {
                    toolbarText.textContent = isChecked ? "Groepen: Aan" : "Groepen: Uit";
                }
                const toolbarBtn = document.getElementById('btn-toolbar-toggle-dept-photos');
                if (toolbarBtn) {
                    if (isChecked) {
                        toolbarBtn.classList.remove('btn-warning');
                        toolbarBtn.classList.add('btn-outline-secondary');
                    } else {
                        toolbarBtn.classList.remove('btn-outline-secondary');
                        toolbarBtn.classList.add('btn-warning');
                    }
                }
                const section = document.getElementById('dept-cards-section');
                if (section) {
                    if (isChecked) {
                        section.classList.remove('dept-section-hidden');
                    } else {
                        section.classList.add('dept-section-hidden');
                    }
                }
                const notice = document.getElementById('dept-hidden-section-notice');
                if (notice) {
                    if (isChecked) {
                        notice.classList.add('d-none');
                        notice.classList.remove('d-flex');
                    } else {
                        notice.classList.remove('d-none');
                        notice.classList.add('d-flex');
                    }
                }
            }
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

        const toolbarDeptPhotosBtn = document.getElementById('btn-toolbar-toggle-dept-photos');
        if (toolbarDeptPhotosBtn) {
            toolbarDeptPhotosBtn.addEventListener('click', () => {
                const toggleInput = document.getElementById('toggle-dept-photos');
                if (toggleInput) {
                    toggleInput.checked = !toggleInput.checked;
                    const key = toggleInput.dataset.liveEditToggle;
                    const val = toggleInput.checked ? '1' : '0';
                    currentState[key] = val;
                    syncToggleVisuals(key, toggleInput.checked);
                    updateDirtyStatus();
                }
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
