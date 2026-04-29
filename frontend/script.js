const chatDisplay = document.getElementById('chat-display');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const chatList = document.getElementById('chat-list');
const modelSelect = document.getElementById('model-select');
const imageUpload = document.getElementById('image-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');

let currentChatId = null;
let chatHistories = JSON.parse(localStorage.getItem('chatHistories')) || {};
let chatNames = JSON.parse(localStorage.getItem('chatNames')) || {};
let currentBase64Image = null;
const pendingChats = new Set();

function saveToLocal() {
    localStorage.setItem('chatHistories', JSON.stringify(chatHistories));
    localStorage.setItem('chatNames', JSON.stringify(chatNames));
    localStorage.setItem('currentChatId', currentChatId);
}

function init() {
    const savedId = localStorage.getItem('currentChatId');
    if (savedId && chatHistories[savedId]) currentChatId = savedId;
    if (!currentChatId || !chatHistories[currentChatId]) createNewChat();
    updateSidebar();
    renderChat();
}

function createNewChat() {
    const id = "chat_" + Date.now();
    chatHistories[id] = [];
    chatNames[id] = `Conversation ${Object.keys(chatHistories).length}`;
    currentChatId = id;
    saveToLocal();
    updateSidebar();
    renderChat();
}

function renderChat() {
    chatDisplay.innerHTML = '';
    const history = chatHistories[currentChatId] || [];
    history.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.role}`;
        if (msg.image) div.innerHTML += `<img src="${msg.image}" class="chat-image">`;
        if (msg.role === 'model') {
            div.innerHTML += marked.parse(msg.text);
            if (msg.usedModel) div.innerHTML += `<div style="font-size:10px; color:gray; border-top:1px solid #ddd; margin-top:5px; padding-top:2px;">⚡ Used: ${msg.usedModel}</div>`;
        } else {
            div.appendChild(document.createTextNode(msg.text));
        }
        chatDisplay.appendChild(div);
    });
    if (pendingChats.has(currentChatId)) chatDisplay.innerHTML += '<div class="message model">Thinking...</div>';
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !currentBase64Image) return;
    const targetId = currentChatId;
    const img = currentBase64Image;
    const model = modelSelect.value;

    chatHistories[targetId].push({ role: 'user', text, image: img });
    userInput.value = '';
    currentBase64Image = null;
    imagePreviewContainer.style.display = 'none';
    pendingChats.add(targetId);
    renderChat();

    try {
        const res = await fetch('http://localhost:5000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: targetId, prompt: text, image: img, model })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        chatHistories[targetId].push({ role: 'model', text: data.text, usedModel: data.usedModel });
    } catch (e) {
        chatHistories[targetId].push({ role: 'model', text: `Error: ${e.message}` });
    } finally {
        pendingChats.delete(targetId);
        saveToLocal();
        if (currentChatId === targetId) renderChat();
    }
}

// Basic Listeners
imageUpload.onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => { currentBase64Image = ev.target.result; document.getElementById('image-preview').src = ev.target.result; imagePreviewContainer.style.display = 'block'; };
    reader.readAsDataURL(e.target.files[0]);
};
document.getElementById('remove-image-btn').onclick = () => { currentBase64Image = null; imagePreviewContainer.style.display = 'none'; };
sendBtn.onclick = sendMessage;
userInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
document.getElementById('new-chat-btn').onclick = createNewChat;
document.getElementById('clear-chat-btn').onclick = () => { delete chatHistories[currentChatId]; init(); };

function updateSidebar() {
    chatList.innerHTML = '';
    Object.keys(chatHistories).forEach(id => {
        const li = document.createElement('li');
        li.className = (id === currentChatId) ? 'active' : '';
        li.innerHTML = `<span>${chatNames[id]}</span><button class="edit-btn">✏️</button>`;
        li.onclick = () => { currentChatId = id; saveToLocal(); updateSidebar(); renderChat(); };
        li.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); const n = prompt("Rename:", chatNames[id]); if (n) { chatNames[id] = n; saveToLocal(); updateSidebar(); } };
        chatList.appendChild(li);
    });
}

init();