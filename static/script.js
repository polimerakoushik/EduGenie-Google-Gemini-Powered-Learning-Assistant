// EduGenie Chat Application Frontend Logic

// DOM Elements
const form = document.getElementById('chat-form');
const messagesArea = document.getElementById('messages');
const textarea = document.getElementById('message');
const clearBtn = document.getElementById('clear-btn');
const infoBtn = document.getElementById('info-btn');
const infoModal = document.getElementById('info-modal');
const modalClose = document.querySelector('.modal-close');
const historyList = document.getElementById('history-list');
const newChatBtn = document.getElementById('new-chat-btn');

// State
let isLoading = false;
let currentConversationId = null;
let conversations = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadConversations();
  startNewConversation();
  renderHistory();
});

// Conversation Management Functions
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function startNewConversation() {
  currentConversationId = generateId();
  conversations[currentConversationId] = {
    id: currentConversationId,
    title: 'New Conversation',
    timestamp: new Date().toLocaleString(),
    messages: []
  };
  messagesArea.innerHTML = `
    <div class="message assistant-message">
      <div class="message-avatar">🧠</div>
      <div class="message-content">
        <p>Hello! I'm EduGenie, your learning assistant.</p>
        <p>Ask me anything about your studies—I'll help you understand complex topics with clear explanations, step-by-step guides, real-world examples, and resources for deeper learning.</p>
        <p><strong>Try asking me about:</strong> Math, Science, History, Languages, Programming, or any subject you're studying!</p>
      </div>
    </div>
  `;
  saveConversations();
  renderHistory();
  updateHistoryTitle();
}

function saveConversations() {
  localStorage.setItem('edu_genie_conversations', JSON.stringify(conversations));
}

function loadConversations() {
  const saved = localStorage.getItem('edu_genie_conversations');
  conversations = saved ? JSON.parse(saved) : {};
}

function renderHistory() {
  historyList.innerHTML = '';
  
  if (Object.keys(conversations).length === 0) {
    historyList.innerHTML = '<div class="empty-history">No conversations yet</div>';
    return;
  }

  // Sort by timestamp (newest first)
  const sorted = Object.values(conversations).sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  sorted.forEach(conv => {
    const item = document.createElement('div');
    item.className = `history-item ${conv.id === currentConversationId ? 'active' : ''}`;
    item.innerHTML = `
      <span class="history-item-title" title="${conv.title}">${conv.title}</span>
      <button class="history-item-delete" onclick="event.stopPropagation(); deleteConversation('${conv.id}')">✕</button>
    `;
    item.addEventListener('click', () => loadConversation(conv.id));
    historyList.appendChild(item);
  });
}

function loadConversation(id) {
  if (!conversations[id]) return;
  
  currentConversationId = id;
  const conv = conversations[id];
  
  messagesArea.innerHTML = '';
  
  if (conv.messages.length === 0) {
    messagesArea.innerHTML = `
      <div class="message assistant-message">
        <div class="message-avatar">🧠</div>
        <div class="message-content">
          <p>Loaded conversation: ${conv.title}</p>
          <p>This conversation is empty. Start asking questions!</p>
        </div>
      </div>
    `;
  } else {
    conv.messages.forEach(msg => {
      addMessageToDOM(msg.text, msg.role);
    });
  }
  
  renderHistory();
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function deleteConversation(id) {
  if (confirm('Delete this conversation?')) {
    delete conversations[id];
    saveConversations();
    
    if (id === currentConversationId) {
      startNewConversation();
    } else {
      renderHistory();
    }
  }
}

function updateHistoryTitle() {
  if (conversations[currentConversationId] && messagesArea.textContent) {
    const firstMessage = conversations[currentConversationId].messages.find(m => m.role === 'user');
    if (firstMessage) {
      const title = firstMessage.text.substring(0, 30) + (firstMessage.text.length > 30 ? '...' : '');
      conversations[currentConversationId].title = title;
      saveConversations();
      renderHistory();
    }
  }
}

// New chat button
newChatBtn.addEventListener('click', startNewConversation);

// Prevent form submission on Enter if Shift is not held
form.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.dispatchEvent(new Event('submit'));
  }
});

// Auto-resize textarea
textarea.addEventListener('input', () => {
  textarea.style.height = 'auto';
  const newHeight = Math.min(textarea.scrollHeight, 150);
  textarea.style.height = newHeight + 'px';
});

// Form submission with streaming
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = textarea.value.trim();

  if (!message || isLoading) return;

  // Clear textarea and reset height
  textarea.value = '';
  textarea.style.height = 'auto';

  // Add user message
  addMessage(message, 'user');

  isLoading = true;

  try {
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Create assistant message placeholder
    const msgElement = document.createElement('div');
    msgElement.className = 'message assistant-message';
    msgElement.innerHTML = '<span class="avatar">🤖</span><div class="content"></div>';
    messagesArea.appendChild(msgElement);
    const contentDiv = msgElement.querySelector('.content');

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Process complete lines
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          const text = line.slice(6);
          contentDiv.textContent += text;
          messagesArea.scrollTop = messagesArea.scrollHeight;
        }
      }

      // Keep incomplete line in buffer
      buffer = lines[lines.length - 1];
    }

    // Handle any remaining buffer content
    if (buffer.startsWith('data: ')) {
      contentDiv.textContent += buffer.slice(6);
    }

    // Save assistant response to conversation
    const completeResponse = contentDiv.textContent;
    if (conversations[currentConversationId]) {
      conversations[currentConversationId].messages.push({
        text: completeResponse,
        role: 'assistant',
        timestamp: new Date().toISOString()
      });
      saveConversations();
    }

    messagesArea.scrollTop = messagesArea.scrollHeight;
  } catch (error) {
    addMessage(
      '❌ Error: ' + (error.message || 'Could not connect to the server.'),
      'assistant',
      true
    );
    console.error('Streaming error:', error);
  } finally {
    isLoading = false;
    textarea.focus();
  }
});

/**
 * Add a message to the chat
 * @param {string} text - Message text
 * @param {string} type - 'user' or 'assistant'
 * @param {boolean} isError - Whether this is an error message
 */
function addMessage(text, type, isError = false) {
  addMessageToDOM(text, type, isError);
  
  // Save to current conversation
  if (conversations[currentConversationId]) {
    conversations[currentConversationId].messages.push({
      text: text,
      role: type,
      timestamp: new Date().toISOString()
    });
    saveConversations();
    updateHistoryTitle();
  }
}

function addMessageToDOM(text, type, isError = false) {
  const messageEl = document.createElement('div');
  const messageClass = `message ${type}-message ${isError ? 'error' : ''}`;
  messageEl.className = messageClass;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = type === 'user' ? '👤' : '🧠';

  const content = document.createElement('div');
  content.className = 'message-content';

  // Parse markdown-like formatting
  let formattedText = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  if (!formattedText.includes('<p>')) {
    formattedText = '<p>' + formattedText + '</p>';
  }

  content.innerHTML = formattedText;

  messageEl.appendChild(avatar);
  messageEl.appendChild(content);

  messagesArea.appendChild(messageEl);
  scrollToBottom();
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
  const messageEl = document.createElement('div');
  messageEl.className = 'message assistant-message loading';
  messageEl.id = 'typing-indicator';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = '🧠';

  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerHTML = `
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  `;

  messageEl.appendChild(avatar);
  messageEl.appendChild(content);
  messagesArea.appendChild(messageEl);
  scrollToBottom();
}

/**
 * Remove typing indicator
 */
function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

/**
 * Scroll to bottom of messages
 */
function scrollToBottom() {
  setTimeout(() => {
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }, 0);
}

/**
 * Clear chat history
 */
clearBtn.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear the chat and start a new conversation?')) {
    return;
  }

  try {
    await fetch('/clear', { method: 'POST' });
    startNewConversation();
  } catch (error) {
    console.error('Error clearing chat:', error);
    alert('Could not clear chat. Please try again.');
  }
});

/**
 * Show info modal
 */
infoBtn.addEventListener('click', () => {
  infoModal.showModal();
});

/**
 * Close modal
 */
modalClose.addEventListener('click', () => {
  infoModal.close();
  infoModal.style.display = 'none';
});

/**
 * Close modal when clicking outside (on backdrop)
 */
infoModal.addEventListener('click', (e) => {
  // Check if click is on the dialog element itself (the backdrop area)
  if (e.target === infoModal) {
    infoModal.close();
    infoModal.style.display = 'none';
  }
});

/**
 * Also allow ESC key to close modal
 */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && infoModal.open) {
    infoModal.close();
    infoModal.style.display = 'none';
  }
});

// Focus textarea on load
window.addEventListener('load', () => {
  textarea.focus();
});

// Log initialization
console.log('EduGenie chat interface loaded');
