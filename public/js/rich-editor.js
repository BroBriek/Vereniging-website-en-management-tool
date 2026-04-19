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

            // Set initial content
            quill.root.innerHTML = textarea.value;

            // Update textarea on change & handle autolink
            quill.on('text-change', function(delta, oldDelta, source) {
                textarea.value = quill.root.innerHTML;

                if (source === 'user') {
                    handleAutoLink(delta);
                }
            });

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
                input.click();

                input.onchange = () => {
                    const file = input.files[0];
                    if (file) {
                        uploadFile(file, quill);
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
