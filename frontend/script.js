const chatDisplay = document.getElementById('chat-display');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const chatList = document.getElementById('chat-list');
const newChatBtn = document.getElementById('new-chat-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');

let currentChatId = null;
let chatHistories = {};
let chatNames = {}; // NEW: Store the custom names for each chat
const pendingChats = new Set();

function saveToLocal() {
    localStorage.setItem('chatHistories', JSON.stringify(chatHistories));
    localStorage.setItem('chatNames', JSON.stringify(chatNames)); // Save names
    if (currentChatId) {
        localStorage.setItem('currentChatId', currentChatId);
    }
}

function init() {
    const savedHistories = localStorage.getItem('chatHistories');
    const savedNames = localStorage.getItem('chatNames');
    const savedCurrentId = localStorage.getItem('currentChatId');

    if (savedHistories) {
        chatHistories = JSON.parse(savedHistories);
        chatNames = savedNames ? JSON.parse(savedNames) : {};

        // Backwards compatibility: If you have old chats without names, give them one
        let count = 1;
        for (const id in chatHistories) {
            if (!chatNames[id]) {
                chatNames[id] = `Conversation ${count}`;
            }
            count++;
        }

        if (savedCurrentId && chatHistories[savedCurrentId]) {
            currentChatId = savedCurrentId;
        } else {
            const keys = Object.keys(chatHistories);
            if (keys.length > 0) currentChatId = keys[keys.length - 1];
        }
    }

    if (!currentChatId || !chatHistories[currentChatId]) {
        createNewChat();
    } else {
        updateSidebar();
        renderChat();
    }
}

function createNewChat() {
    const newId = "chat_" + Date.now();
    chatHistories[newId] = [];
    
    // Generate a default name based on how many chats exist
    const chatCount = Object.keys(chatHistories).length;
    chatNames[newId] = `Conversation ${chatCount}`;
    
    currentChatId = newId;
    saveToLocal();
    updateSidebar();
    renderChat();
}

function updateSidebar() {
    chatList.innerHTML = '';
    
    for (const id in chatHistories) {
        const li = document.createElement('li');
        
        // 1. Add the text span for the name
        const titleSpan = document.createElement('span');
        titleSpan.className = 'chat-title-text';
        titleSpan.textContent = chatNames[id];
        li.appendChild(titleSpan);

        // 2. Add the Edit (Rename) button
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '✏️';
        editBtn.onclick = (e) => {
            e.stopPropagation(); // Stops the click from also switching the chat
            const newName = prompt("Rename this chat:", chatNames[id]);
            if (newName !== null && newName.trim() !== "") {
                chatNames[id] = newName.trim();
                saveToLocal();
                updateSidebar(); // Refresh the list to show the new name
            }
        };
        li.appendChild(editBtn);

        // Highlight the active chat
        if (id === currentChatId) li.classList.add('active');
        
        // Handle switching chats
        li.onclick = () => {
            currentChatId = id;
            saveToLocal();
            updateSidebar();
            renderChat();
        };
        
        chatList.appendChild(li);
    }
}

function renderChat() {
    chatDisplay.innerHTML = '';
    const history = chatHistories[currentChatId];

    if (!history || history.length === 0) {
        chatDisplay.innerHTML = '<div class="message system">Start a new conversation!</div>';
        return;
    }

    history.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.role}`;
        
        if (msg.role === 'model') {
            div.innerHTML = marked.parse(msg.text);
            if (window.renderMathInElement) {
                renderMathInElement(div, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\(', right: '\\)', display: false},
                        {left: '\\[', right: '\\]', display: true}
                    ],
                    throwOnError: false
                });
            }
        } else {
            div.textContent = msg.text;
        }
        
        chatDisplay.appendChild(div);
    });

    if (pendingChats.has(currentChatId)) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message model';
        loadingDiv.textContent = 'Thinking...';
        loadingDiv.id = 'loading-msg';
        chatDisplay.appendChild(loadingDiv);
    }

    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    const targetChatId = currentChatId;

    chatHistories[targetChatId].push({ role: 'user', text: text });
    userInput.value = '';
    saveToLocal();

    pendingChats.add(targetChatId);

    if (currentChatId === targetChatId) renderChat();

    try {
        const response = await fetch('http://localhost:5000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: targetChatId, prompt: text })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        chatHistories[targetChatId].push({ role: 'model', text: data.text });

    } catch (error) {
        console.error(error);
        chatHistories[targetChatId].push({ role: 'system', text: 'Error: Could not connect to the backend.' });
    } finally {
        pendingChats.delete(targetChatId);
        saveToLocal();
        if (currentChatId === targetChatId) renderChat();
    }
}

function deleteCurrentChat() {
    delete chatHistories[currentChatId];
    delete chatNames[currentChatId]; // NEW: Also delete the name from memory!
    
    const remainingChats = Object.keys(chatHistories);
    
    if (remainingChats.length > 0) {
        currentChatId = remainingChats[remainingChats.length - 1];
        saveToLocal();
        updateSidebar();
        renderChat();
    } else {
        createNewChat();
    }
}

// Event Listeners
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
newChatBtn.addEventListener('click', createNewChat);
clearChatBtn.addEventListener('click', deleteCurrentChat);

// Start the app
init();