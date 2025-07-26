const API_BASE = 'http://127.0.0.1:5000/api';

// Load files on page load
document.addEventListener('DOMContentLoaded', function() {
    loadFiles();
    
    // Enter key support - moved inside DOMContentLoaded
    document.getElementById('questionInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            askQuestion();
        }
    });
});

// Upload files
async function uploadFiles() {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;
    
    if (files.length === 0) {
        showMessage('Please select at least one file', 'error');
        return;
    }

    showLoading(true);
    
    for (let file of files) {
        const formData = new FormData();
        formData.append('pdf', file);
        
        try {
            const response = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showMessage(`${result.message} (Auto-delete in ${result.auto_delete_in} minutes)`, 'success');
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            showMessage('Upload failed: ' + error.message, 'error');
        }
    }
    
    fileInput.value = '';
    loadFiles();
    showLoading(false);
}

// Load and display files
async function loadFiles() {
    try {
        const response = await fetch(`${API_BASE}/list-files`);
        const result = await response.json();
        
        if (response.ok) {
            displayFiles(result.files);
            
            // Enable/disable chat based on files
            const hasFiles = result.files.length > 0;
            document.getElementById('questionInput').disabled = !hasFiles;
            document.getElementById('askBtn').disabled = !hasFiles;
        }
    } catch (error) {
        console.error('Error loading files:', error);
    }
}

// Display files
function displayFiles(files) {
    const fileList = document.getElementById('fileList');
    
    if (files.length === 0) {
        fileList.innerHTML = 'No files uploaded';
        return;
    }
    
    fileList.innerHTML = files.map(file => `
        <div class="file-item">
            <div>
                <strong>${file.name}</strong>
                <br>
                <small>Size: ${formatFileSize(file.size)} | 
                Time left: ${file.time_remaining ? file.time_remaining + ' min' : 'Expires soon'}</small>
            </div>
            <button class="delete-btn" onclick="deleteFile('${file.name}')">Delete</button>
        </div>
    `).join('');
}

// Delete file
async function deleteFile(filename) {
    if (!confirm(`Delete ${filename}?`)) return;
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/delete/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage(result.message, 'success');
            loadFiles();
        } else {
            showMessage(result.error, 'error');
        }
    } catch (error) {
        showMessage('Delete failed: ' + error.message, 'error');
    }
    
    showLoading(false);
}

// Ask question
async function askQuestion() {
    const questionInput = document.getElementById('questionInput');
    const question = questionInput.value.trim();
    
    if (!question) return;
    
    // Add user message
    addMessage(question, 'user');
    questionInput.value = '';
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            addMessage(result.answer, 'ai', result.sources);
        } else {
            addMessage('Error: ' + result.error, 'ai');
        }
    } catch (error) {
        addMessage('Error: ' + error.message, 'ai');
    }
    
    showLoading(false);
}

// Add message to chat
function addMessage(content, sender, sources = null) {
    const chatBox = document.getElementById('chatBox');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    let messageHTML = content;
    
    if (sources && sources.length > 0) {
        messageHTML += '<div class="sources"><strong>Sources:</strong><br>';
        sources.forEach(source => {
            messageHTML += `<div>${source.source} (Page ${source.page}): ${source.content}</div>`;
        });
        messageHTML += '</div>';
    }
    
    messageDiv.innerHTML = messageHTML;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Show loading
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// Show message
function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = type;
    messageDiv.textContent = message;
    
    document.querySelector('.container').insertBefore(messageDiv, document.querySelector('.section'));
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}