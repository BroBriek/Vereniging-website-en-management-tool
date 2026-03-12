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
        script.onload = () => runInit(elements);
        document.head.appendChild(script);
    } else {
        runInit(elements);
    }

    function runInit(targets) {
        targets.forEach(textarea => {
            if(textarea.classList.contains('rich-editor-initialized')) return;
            textarea.classList.add('rich-editor-initialized');

            // Create a container for the editor
            const container = document.createElement('div');
            // Set a default height or copy from textarea
            container.style.height = '300px';
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
                            image: imageHandler
                        }
                    }
                }
            });

            // Set initial content
            quill.root.innerHTML = textarea.value;

            // Update textarea on change
            quill.on('text-change', function() {
                textarea.value = quill.root.innerHTML;
            });

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
        });
    }
};

document.addEventListener("DOMContentLoaded", function() {
    window.initializeRichEditors();
});
