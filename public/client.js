// WebSocket connection
let ws = null;
let userId = null;
let username = null;
let myLanguage = 'en';  // Language I want to RECEIVE in
let translateToLanguage = 'auto';  // Language to SEND my messages in
let isConnected = false;

// Language names mapping
const languageNames = {
    'en': 'English',
    'es': 'Español',
    'fr': 'Français',
    'de': 'Deutsch',
    'zh': '中文',
    'ja': '日本語',
    'pt': 'Português',
    'ru': 'Русский',
    'auto': 'Auto (No translation)'
};

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const usernameInput = document.getElementById('usernameInput');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesList = document.getElementById('messagesList');
const usersList = document.getElementById('usersList');
const currentUserSpan = document.getElementById('currentUser');
const connectionStatus = document.getElementById('connectionStatus');
const userCount = document.getElementById('userCount');
const charCount = document.getElementById('charCount');
const translationModal = document.getElementById('translationModal');
const translationBody = document.getElementById('translationBody');
const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const myLanguageSelect = document.getElementById('myLanguageSelect');
const translateToSelect = document.getElementById('translateToSelect');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const modalCloses = document.querySelectorAll('.modal-close');
const savedUsernameSpan = document.getElementById('savedUsername');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSavedSettings();
    setupEventListeners();
    checkAutoLogin();
});

// Load saved settings from localStorage
function loadSavedSettings() {
    const saved = localStorage.getItem('chatUsername');
    const savedMyLang = localStorage.getItem('myLanguage');
    const savedTranslateTo = localStorage.getItem('translateToLanguage');
    
    if (saved) {
        usernameInput.value = saved;
        savedUsernameSpan.textContent = `Last used: ${saved}`;
    }
    
    if (savedMyLang) {
        myLanguage = savedMyLang;
        myLanguageSelect.value = savedMyLang;
    }
    
    if (savedTranslateTo) {
        translateToLanguage = savedTranslateTo;
        translateToSelect.value = savedTranslateTo;
    }
}

// Setup event listeners
function setupEventListeners() {
    joinBtn.addEventListener('click', joinChat);
    leaveBtn.addEventListener('click', leaveChat);
    sendBtn.addEventListener('click', sendMessage);
    settingsBtn.addEventListener('click', openSettings);
    saveSettingsBtn.addEventListener('click', saveSettings);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    messageInput.addEventListener('input', updateCharCount);
    
    // Close modals
    modalCloses.forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    translationModal.addEventListener('click', (e) => {
        if (e.target === translationModal) closeAllModals();
    });
    
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeAllModals();
    });
}

// Update character count
function updateCharCount() {
    charCount.textContent = messageInput.value.length;
    if (messageInput.value.length > 500) {
        messageInput.value = messageInput.value.substring(0, 500);
        charCount.textContent = '500';
    }
}

// Check if should auto-login
function checkAutoLogin() {
    const saved = localStorage.getItem('chatUsername');
    if (saved) {
        usernameInput.focus();
        // Show hint that they can press enter or will auto-login
    }
}

// Join chat
async function joinChat() {
    const inputUsername = usernameInput.value.trim();
    
    if (!inputUsername) {
        alert('Please enter a username');
        return;
    }

    if (inputUsername.length < 2) {
        alert('Username must be at least 2 characters');
        return;
    }

    username = inputUsername;
    userId = generateUserId();

    // Save settings to localStorage
    localStorage.setItem('chatUsername', username);
    localStorage.setItem('myLanguage', myLanguage);
    localStorage.setItem('translateToLanguage', translateToLanguage);

    // Connect to WebSocket
    connectWebSocket();
}

// Generate unique user ID
function generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Connect to WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws = new WebSocket(wsUrl);

    ws.addEventListener('open', () => {
        console.log('Connected to server');
        isConnected = true;
        updateConnectionStatus(true);

        // Send join message
        ws.send(JSON.stringify({
            type: 'join',
            userId,
            username
        }));

        // Switch to chat screen
        loginScreen.classList.remove('active');
        chatScreen.classList.add('active');
        currentUserSpan.textContent = username;
        messageInput.focus();
    });

    ws.addEventListener('message', handleMessage);

    ws.addEventListener('close', () => {
        console.log('Disconnected from server');
        isConnected = false;
        updateConnectionStatus(false);
    });

    ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        alert('Connection error. Please refresh the page and try again.');
    });
}

// Handle incoming messages
function handleMessage(event) {
    try {
        const data = JSON.parse(event.data);

        if (data.type === 'chat') {
            displayMessage(data);
        } else if (data.type === 'system') {
            displaySystemMessage(data);
        } else if (data.type === 'user-list') {
            updateUserList(data.users);
        } else if (data.type === 'translation-result') {
            console.log('Translation result:', data);
        }
    } catch (error) {
        console.error('Error parsing message:', error);
    }
}

// Display chat message
function displayMessage(data) {
    const messageDiv = document.createElement('div');
    const isOwnMessage = data.userId === userId;
    messageDiv.className = `message ${isOwnMessage ? 'own' : 'other'}`;

    const hasTranslations = Object.keys(data.translations).length > 0;
    const messageClass = hasTranslations ? 'message-bubble has-translation' : 'message-bubble';

    const avatarInitial = data.username.charAt(0).toUpperCase();
    const now = new Date(data.timestamp);
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Get the message in user's language preference
    const displayText = data.translations[myLanguage] || data.translations['en'] || data.originalMessage;

    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-avatar">${avatarInitial}</div>
            <div>
                <div class="${messageClass}">
                    <div class="message-header">
                        <span class="message-username">${escapeHtml(data.username)}</span>
                        <span class="message-time">${timeString}</span>
                    </div>
                    <div class="message-text">${escapeHtml(displayText)}</div>
                    ${hasTranslations && Object.keys(data.translations).length > 1 ? '<div class="message-translation-hint">Click to see translations</div>' : ''}
                </div>
            </div>
        </div>
    `;

    if (hasTranslations && Object.keys(data.translations).length > 1) {
        messageDiv.addEventListener('click', () => showTranslations(data));
    }

    messagesList.appendChild(messageDiv);
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Display system message
function displaySystemMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.innerHTML = `<div class="message-system">${escapeHtml(data.message)}</div>`;
    messagesList.appendChild(messageDiv);
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Show all translations in modal
function showTranslations(data) {
    translationBody.innerHTML = '';

    // Add original message first
    const originalLang = data.translations[data.username] ? data.username : 
                         Object.keys(data.translations)[0];
    
    for (const [lang, text] of Object.entries(data.translations)) {
        const langName = languageNames[lang] || lang;
        const item = document.createElement('div');
        item.className = 'translation-item';
        item.innerHTML = `
            <div class="translation-language">${langName}</div>
            <div class="translation-text">${escapeHtml(text)}</div>
        `;
        translationBody.appendChild(item);
    }

    translationModal.classList.add('active');
}

// Close all modals
function closeAllModals() {
    translationModal.classList.remove('active');
    settingsModal.classList.remove('active');
}

// Open settings modal
function openSettings() {
    myLanguageSelect.value = translateToLanguage;  // What I SEND in
    translateToSelect.value = myLanguage;  // What I RECEIVE in
    settingsModal.classList.add('active');
}

// Save language settings
function saveSettings() {
    translateToLanguage = myLanguageSelect.value;  // What I SEND in
    myLanguage = translateToSelect.value;  // What I RECEIVE in
    
    // Save to localStorage
    localStorage.setItem('myLanguage', myLanguage);
    localStorage.setItem('translateToLanguage', translateToLanguage);
    
    closeAllModals();
    alert('Settings saved!');
}

// Update user list
function updateUserList(users) {
    usersList.innerHTML = '';
    userCount.textContent = users.length;

    if (users.length === 0) {
        usersList.innerHTML = '<p class="loading">No users online</p>';
        return;
    }

    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <div class="user-item-name">${escapeHtml(user.username)}</div>
            <div class="user-item-status">● Online</div>
        `;
        usersList.appendChild(userItem);
    });
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();

    if (!message) {
        return;
    }

    if (!isConnected) {
        alert('Not connected to server');
        return;
    }

    ws.send(JSON.stringify({
        type: 'chat',
        message,
        outgoingLanguage: translateToLanguage,
        incomingLanguage: myLanguage
    }));

    messageInput.value = '';
    charCount.textContent = '0';
    messageInput.focus();
}

// Leave chat
function leaveChat() {
    if (ws) {
        ws.close();
    }

    // Clear username to force login page
    localStorage.removeItem('chatUsername');
    
    loginScreen.classList.add('active');
    chatScreen.classList.remove('active');
    messagesList.innerHTML = `
        <div class="welcome-message">
            <h2>Welcome to Global Chat</h2>
            <p>Messages are automatically translated using Groq AI</p>
            <p>Click on a message to see all translations</p>
        </div>
    `;
    usersList.innerHTML = '<p class="loading">Connecting...</p>';
    userCount.textContent = '0';
    messageInput.value = '';
    charCount.textContent = '0';
    usernameInput.value = '';
    usernameInput.focus();
}

// Update connection status
function updateConnectionStatus(connected) {
    if (connected) {
        connectionStatus.classList.remove('disconnected');
        connectionStatus.classList.add('connected');
    } else {
        connectionStatus.classList.remove('connected');
        connectionStatus.classList.add('disconnected');
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Auto-reconnect on page visibility change
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !isConnected && username) {
        console.log('Page visible, attempting to reconnect...');
        connectWebSocket();
    }
});

// Prompt before leaving if connected
window.addEventListener('beforeunload', (e) => {
    if (isConnected) {
        e.preventDefault();
        e.returnValue = '';
    }
});
