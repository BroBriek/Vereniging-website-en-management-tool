// Mention Logic
document.addEventListener('DOMContentLoaded', function() {
    const textareas = document.querySelectorAll('textarea[name="content"], input[name="content"]');
    
    // Create autocomplete list element
    const list = document.createElement('ul');
    list.className = 'list-group position-absolute shadow-lg border-0 d-none';
    list.style.zIndex = '1050';
    list.style.maxHeight = '200px';
    list.style.overflowY = 'auto';
    list.style.width = '200px';
    document.body.appendChild(list);

    let activeInput = null;

    textareas.forEach(input => {
        input.addEventListener('input', async function(e) {
            const cursorPosition = this.selectionStart;
            const textBeforeCursor = this.value.substring(0, cursorPosition);
            const words = textBeforeCursor.split(/\s+/);
            const currentWord = words[words.length - 1];

            if (currentWord.startsWith('@') && currentWord.length >= 1) {
                activeInput = this;
                const query = currentWord.substring(1);
                
                try {
                    const response = await fetch(`/feed/api/users?q=${query}`);
                    if (!response.ok) throw new Error('Network response was not ok');
                    const users = await response.json();

                    if (users.length > 0) {
                        const rect = this.getBoundingClientRect();
                        // Crude positioning approximation (ideally use a library like getCaretCoordinates)
                        // For now, placing it under the input box
                        list.style.top = (rect.bottom + window.scrollY) + 'px';
                        list.style.left = (rect.left + window.scrollX) + 'px';
                        
                        list.innerHTML = '';
                        users.forEach(user => {
                            const displayName = user.username.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                            const item = document.createElement('li');
                            item.className = 'list-group-item list-group-item-action cursor-pointer d-flex align-items-center';
                            item.innerHTML = `<i class="bi bi-person-circle me-2 text-primary"></i> ${displayName}`;
                            item.onclick = function() {
                                selectUser(user.username); // Keep insertion as raw username to be safe, or displayName if preferred. 
                                // Actually, let's insert the capitalized name as it looks better.
                                // selectUser(displayName);
                            };
                            // Let's stick to inserting what the user selects visually? 
                            // If I insert "John", the backend sees "john". That's fine.
                            // But if I insert "John", and the user types "@Jo...", they see "John".
                            // Let's use displayName for insertion too.
                            item.onclick = function() {
                                selectUser(displayName);
                            };
                            list.appendChild(item);
                        });
                        list.classList.remove('d-none');
                    } else {
                        list.classList.add('d-none');
                    }
                } catch (err) {
                    console.error('Mention lookup error', err);
                }
            } else {
                list.classList.add('d-none');
            }
        });

        // Hide on blur, but delay to allow click
        input.addEventListener('blur', function() {
            setTimeout(() => list.classList.add('d-none'), 200);
        });
    });

    function selectUser(username) {
        if (!activeInput) return;
        
        const cursorPosition = activeInput.selectionStart;
        const text = activeInput.value;
        const textBefore = text.substring(0, cursorPosition);
        const textAfter = text.substring(cursorPosition);
        
        const lastAt = textBefore.lastIndexOf('@');
        const newText = text.substring(0, lastAt) + '@' + username + ' ' + textAfter;
        
        activeInput.value = newText;
        activeInput.focus();
        list.classList.add('d-none');
    }
});
