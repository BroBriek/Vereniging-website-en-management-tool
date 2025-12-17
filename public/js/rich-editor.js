document.addEventListener("DOMContentLoaded", function() {
    // Select all textareas with class 'rich-editor'
    const editors = document.querySelectorAll('.rich-editor');

    if (editors.length === 0) return;

    // Load Quill CSS if not already loaded
    if (!document.querySelector('link[href*="quill.snow.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
        document.head.appendChild(link);
    }

    // Load Quill JS and then initialize
    if (typeof Quill === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.quilljs.com/1.3.6/quill.min.js';
        script.onload = () => initializeEditors(editors);
        document.head.appendChild(script);
    } else {
        initializeEditors(editors);
    }

    function initializeEditors(elements) {
        elements.forEach(textarea => {
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

            // Image Handler
            function imageHandler() {
                const input = document.createElement('input');
                input.setAttribute('type', 'file');
                input.setAttribute('accept', 'image/*');
                input.click();

                input.onchange = async () => {
                    const file = input.files[0];
                    if (file) {
                        const formData = new FormData();
                        formData.append('image', file);

                        try {
                            // Show loading placeholder or state if possible
                            const range = quill.getSelection();
                            
                            const response = await fetch('/admin/api/upload-image', {
                                method: 'POST',
                                body: formData
                            });

                            if (!response.ok) throw new Error('Upload failed');

                            const data = await response.json();
                            
                            // Insert image
                            quill.insertEmbed(range.index, 'image', data.url);
                        } catch (error) {
                            console.error('Error:', error);
                            alert('Kon afbeelding niet uploaden. Probeer opnieuw.');
                        }
                    }
                };
            }
            
            // Optional: Handle paste events to upload images instead of base64
            // (For simplicity, we leave base64 paste as fallback or implement paste handler later if needed.
            // Quill's default paste matches the "Simple" requirement, but let's stick to the button handler for now.)
        });
    }
});
