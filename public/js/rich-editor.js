// Make it global so it can be called dynamically
window.initializeRichEditors = function(elements) {
    // If specific elements passed, use them. Otherwise find all uninitialized .rich-editor
    if (!elements) {
        // We use a class 'rich-editor-initialized' to prevent double init
        elements = document.querySelectorAll('.rich-editor:not(.rich-editor-initialized)');
    } else if (elements instanceof Element) {
        elements = [elements];
    }

    if (elements.length === 0) return;
    
    // Load Quill CSS if not already loaded
    if (!document.querySelector('link[href*="quill.snow.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
        document.head.appendChild(link);
    }

    // Ensure Quill is loaded
    if (typeof Quill === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.quilljs.com/1.3.6/quill.min.js';
        script.onload = () => {
            setupQuillExtensions();
            runInit(elements);
        };
        document.head.appendChild(script);
    } else {
        setupQuillExtensions();
        runInit(elements);
    }

    function setupQuillExtensions() {
        if (window.QuillExtensionsRegistered) return;
        
        // Extend Link blot to add target="_blank" for external links
        const Link = Quill.import('formats/link');
        class MyLink extends Link {
            static create(value) {
                let node = super.create(value);
                value = this.sanitize(value);
                node.setAttribute('href', value);
                // Check if it's an external link
                const isExternal = /^https?:\/\//i.test(value) || (!value.startsWith('/') && !value.startsWith('#') && !value.startsWith('mailto:') && !value.startsWith('tel:'));
                if (isExternal) {
                    node.setAttribute('target', '_blank');
                    node.setAttribute('rel', 'noopener noreferrer');
                }
                return node;
            }
        }
        Quill.register(MyLink, true);
        window.QuillExtensionsRegistered = true;
    }

    function runInit(targets) {
        targets.forEach(textarea => {
            if(textarea.classList.contains('rich-editor-initialized')) return;
            textarea.classList.add('rich-editor-initialized');

            // Create a container for the editor
            const container = document.createElement('div');
            // Set a default height or copy from textarea
            container.style.height = textarea.rows > 4 ? (textarea.rows * 25) + 'px' : '300px';
            container.style.backgroundColor = 'white';
            
            // Insert container after textarea
            textarea.parentNode.insertBefore(container, textarea.nextSibling);
            
            // Hide the original textarea
            textarea.style.display = 'none';

            // Initialize Quill
            const quill = new Quill(container, {
                theme: 'snow',
                modules: {
                    toolbar: {
                        container: [
                            [{ 'header': [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'color': [] }, { 'background': [] }],
                            [{ 'align': [] }],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['link', 'image', 'clean']
                        ],
                        handlers: {
                            image: imageHandler,
                            link: linkHandler
                        }
                    }
                }
            });

            // Create a persistent hidden file input for this editor instance to bypass iOS standalone PWA limitations
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.position = 'absolute';
            fileInput.style.top = '-9999px';
            fileInput.style.left = '-9999px';
            fileInput.style.visibility = 'hidden';
            document.body.appendChild(fileInput);

            fileInput.onchange = () => {
                const file = fileInput.files[0];
                if (file) {
                    uploadFile(file, quill);
                }
                fileInput.value = ''; // Reset to allow uploading the same file again
            };

            // Intercept click on the toolbar image button directly in the capture phase
            // to bypass any event wrapping or microtasks introduced by Quill.
            const toolbarModule = quill.getModule('toolbar');
            if (toolbarModule && toolbarModule.container) {
                const imageButton = toolbarModule.container.querySelector('.ql-image');
                if (imageButton) {
                    imageButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fileInput.click();
                    }, true); // Use capture phase
                }
            }

            // Set container to position relative for mention list positioning
            container.style.position = 'relative';

            // Set initial content
            quill.root.innerHTML = textarea.value;

            // --- @ Mention / Game Tagging Logic ---
            const mentionList = document.createElement('div');
            mentionList.className = 'mention-suggestions list-group position-absolute shadow-lg d-none';
            mentionList.style.zIndex = '9999';
            mentionList.style.maxHeight = '250px';
            mentionList.style.overflowY = 'auto';
            mentionList.style.minWidth = '250px';
            mentionList.style.borderRadius = '1rem';
            mentionList.style.border = '1px solid #e2e8f0';
            mentionList.style.backgroundColor = 'white';
            // Append to body to avoid overflow:hidden clipping from editor containers
            document.body.appendChild(mentionList);

            let mentionQuery = '';
            let mentionStartIndex = -1;
            let isFetchingMentions = false;

            quill.on('text-change', function(delta, oldDelta, source) {
                textarea.value = quill.root.innerHTML;

                // Dispatch input event to notify any live preview listeners
                textarea.dispatchEvent(new Event('input', { bubbles: true }));

                // Handle both 'user' and other sources just in case some browsers report differently
                handleAutoLink(delta);
                handleMention(delta);
            });

            async function handleMention(delta) {
                try {
                    const range = quill.getSelection();
                    if (!range) {
                        mentionList.classList.add('d-none');
                        return;
                    }

                    const textBefore = quill.getText(0, range.index);
                    const lastAt = textBefore.lastIndexOf('@');
                    
                    // If there's an @ and no space between it and cursor
                    if (lastAt !== -1 && !textBefore.substring(lastAt).includes(' ')) {
                        mentionStartIndex = lastAt;
                        mentionQuery = textBefore.substring(lastAt + 1);
                        
                        // Show searching state
                        renderMentionList([], lastAt, true, true);
                        
                        isFetchingMentions = true;
                        const response = await fetch(`/games/api/search?q=${mentionQuery}`);
                        isFetchingMentions = false;
                        
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        const games = await response.json();
                        renderMentionList(games, lastAt, mentionQuery.length === 0, false);
                    } else {
                        mentionList.classList.add('d-none');
                    }
                } catch (err) {
                    console.error('Mention fetch error:', err);
                    isFetchingMentions = false;
                }
            }

            function renderMentionList(games, index, isInitial = false, isSearching = false) {
                const bounds = quill.getBounds(index);
                const editorRect = container.getBoundingClientRect();
                
                // Use absolute positioning relative to document body
                mentionList.style.top = (editorRect.top + bounds.top + bounds.height + 5 + window.scrollY) + 'px';
                mentionList.style.left = (editorRect.left + bounds.left + window.scrollX) + 'px';
                
                mentionList.innerHTML = '';
                
                if (isSearching && !games.length) {
                    const item = document.createElement('div');
                    item.className = 'list-group-item disabled text-muted small border-0';
                    item.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span> Zoeken...';
                    mentionList.appendChild(item);
                } else if (isInitial && games.length === 0) {
                    const item = document.createElement('div');
                    item.className = 'list-group-item disabled text-muted small border-0';
                    item.innerHTML = '<i class="bi bi-search me-2"></i> Typ de titel van een spel...';
                    mentionList.appendChild(item);
                } else if (games.length === 0 && !isInitial && !isSearching) {
                    const item = document.createElement('div');
                    item.className = 'list-group-item disabled text-muted small border-0';
                    item.innerHTML = 'Geen spellen gevonden...';
                    mentionList.appendChild(item);
                } else if (games.length > 0) {
                    games.forEach(game => {
                        const item = document.createElement('button');
                        item.type = 'button';
                        item.className = 'list-group-item list-group-item-action border-0 d-flex align-items-center gap-2 py-2';
                        item.innerHTML = `<i class="bi bi-controller text-danger"></i> <span class="fw-bold">${game.title}</span>`;
                        item.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            insertGameLink(game);
                        };
                        mentionList.appendChild(item);
                    });
                }
                
                if (mentionList.innerHTML !== '') {
                    mentionList.classList.remove('d-none');
                }
            }

            function insertGameLink(game) {
                const range = quill.getSelection();
                if (!range) return;

                // Delete the @query
                const lengthToDelete = mentionQuery.length + 1;
                quill.deleteText(mentionStartIndex, lengthToDelete);
                
                // Insert the link
                quill.insertText(mentionStartIndex, game.title, 'link', `/games/${game.id}`);
                quill.insertText(mentionStartIndex + game.title.length, ' ');
                
                // Move cursor
                quill.setSelection(mentionStartIndex + game.title.length + 1);
                
                mentionList.classList.add('d-none');
            }

            // Close mention list on click outside
            document.addEventListener('click', (e) => {
                if (!mentionList.contains(e.target) && !container.contains(e.target)) {
                    mentionList.classList.add('d-none');
                }
            });

            // --- End Mention Logic ---

            function handleAutoLink(delta) {
                const lastOp = delta.ops[delta.ops.length - 1];
                if (lastOp && typeof lastOp.insert === 'string' && lastOp.insert.endsWith(' ')) {
                    const range = quill.getSelection();
                    if (!range) return;
                    
                    const textBefore = quill.getText(0, range.index - 1);
                    const lastWordMatch = textBefore.match(/\S+$/);
                    if (!lastWordMatch) return;
                    
                    const lastWord = lastWordMatch[0];
                    const urlRegex = /^(https?:\/\/|www\.)[^\s]+\.[^\s]+$/i;
                    
                    if (urlRegex.test(lastWord)) {
                        const start = lastWordMatch.index;
                        let url = lastWord;
                        if (url.toLowerCase().startsWith('www.')) {
                            url = 'https://' + url;
                        }
                        
                        // Check if already formatted as link to avoid redundant ops
                        const formats = quill.getFormat(start, lastWord.length);
                        if (!formats.link) {
                            quill.formatText(start, lastWord.length, 'link', url);
                        }
                    }
                }
            }

            // Handle Pasting Images
            quill.root.addEventListener('paste', (event) => {
                const items = (event.clipboardData || event.originalEvent.clipboardData).items;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        const file = items[i].getAsFile();
                        uploadFile(file, quill);
                    }
                }
            });

            // Handle Dropping Images
            quill.root.addEventListener('drop', (event) => {
                event.preventDefault();
                const files = event.dataTransfer.files;
                if (files && files.length > 0) {
                    for (let i = 0; i < files.length; i++) {
                        if (files[i].type.indexOf('image') !== -1) {
                            uploadFile(files[i], quill);
                        }
                    }
                }
            }, false);

            // Reusable Upload Function
            async function uploadFile(file, quillInstance) {
                const formData = new FormData();
                formData.append('image', file);

                try {
                    // Show a placeholder or loading state if needed
                    const range = quillInstance.getSelection() || { index: quillInstance.getLength() };
                    
                    const response = await fetch('/admin/api/upload-image', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) throw new Error('Upload failed');

                    const data = await response.json();
                    quillInstance.insertEmbed(range.index, 'image', data.url);
                    quillInstance.setSelection(range.index + 1);
                } catch (error) {
                    console.error('Error:', error);
                    alert('Kon afbeelding niet uploaden. Probeer opnieuw.');
                }
            }

            // Image Handler for toolbar
            function imageHandler() {
                const input = document.createElement('input');
                input.setAttribute('type', 'file');
                input.setAttribute('accept', 'image/*');
                
                // Hide it off-screen but keep it in the DOM flow for iOS Safari compliance
                input.style.position = 'absolute';
                input.style.top = '-9999px';
                input.style.left = '-9999px';
                input.style.visibility = 'hidden';
                
                document.body.appendChild(input);
                input.click();

                input.onchange = () => {
                    const file = input.files[0];
                    if (file) {
                        uploadFile(file, quill);
                    }
                    if (input.parentNode) {
                        document.body.removeChild(input);
                    }
                };
            }

            // Link Handler for toolbar (using Bootstrap Modal)
            function linkHandler() {
                const range = quill.getSelection();
                const modalEl = document.getElementById('quillLinkModal');
                if (!modalEl) {
                    // Fallback to default if modal not present
                    const url = prompt('Enter URL:');
                    if (url) quill.format('link', url);
                    return;
                }

                const modal = new bootstrap.Modal(modalEl);
                const urlInput = document.getElementById('quillLinkUrl');
                const textInput = document.getElementById('quillLinkText');
                const submitBtn = document.getElementById('quillLinkSubmit');

                urlInput.value = '';
                textInput.value = '';

                // If text is selected, pre-fill text input and disable it or just pre-fill
                if (range && range.length > 0) {
                    textInput.value = quill.getText(range.index, range.length);
                }

                const onConfirm = () => {
                    let url = urlInput.value.trim();
                    const text = textInput.value.trim();

                    if (url) {
                        if (!/^https?:\/\//i.test(url) && !url.startsWith('/') && !url.startsWith('#')) {
                            url = 'https://' + url;
                        }

                        if (range && range.length > 0) {
                            // Replace selected text
                            quill.deleteText(range.index, range.length);
                            quill.insertText(range.index, text || url, 'link', url);
                            quill.setSelection(range.index + (text || url).length);
                        } else {
                            // Insert at cursor
                            const index = range ? range.index : quill.getLength();
                            quill.insertText(index, text || url, 'link', url);
                            quill.setSelection(index + (text || url).length);
                        }
                    }
                    modal.hide();
                    cleanup();
                };

                const onKeyPress = (e) => {
                    if (e.key === 'Enter') onConfirm();
                };

                const cleanup = () => {
                    submitBtn.removeEventListener('click', onConfirm);
                    urlInput.removeEventListener('keypress', onKeyPress);
                    textInput.removeEventListener('keypress', onKeyPress);
                    modalEl.removeEventListener('hidden.bs.modal', cleanup);
                };

                submitBtn.addEventListener('click', onConfirm);
                urlInput.addEventListener('keypress', onKeyPress);
                textInput.addEventListener('keypress', onKeyPress);
                modalEl.addEventListener('hidden.bs.modal', cleanup);

                modal.show();
                setTimeout(() => urlInput.focus(), 500);
            }
        });
    }
};

document.addEventListener("DOMContentLoaded", function() {
    window.initializeRichEditors();
});
