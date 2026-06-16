// chatbot.js - AI Startup Advisor Chatbot Logic

// localStorage key for startup idea context
const STARTUP_IDEA_STORAGE_KEY = 'startup_idea_context';

const chatArea = document.getElementById('chat-area');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const typingIndicator = document.getElementById('typing-indicator');
const welcomeState = document.getElementById('welcome-state');
const suggestionCards = document.querySelectorAll('.suggestion-card');

let chatHistory = [];
let isTyping = false;
let startupIdeaContext = null; // Store the startup idea context

// Load startup idea context on page load
function loadStartupIdeaContext() {
  const stored = localStorage.getItem(STARTUP_IDEA_STORAGE_KEY);
  if (stored) {
    try {
      startupIdeaContext = JSON.parse(stored);
    } catch (err) {
      console.error('Error parsing startup idea context:', err);
      startupIdeaContext = null;
    }
  }
}

// Add startup context to user message if available
function enhanceMessageWithContext(userMessage) {
  if (!startupIdeaContext) {
    return userMessage;
  }
  
  // Prepend the startup idea context to the message
  const contextPrefix = `[Startup Context: Title: "${startupIdeaContext.title}", Description: "${startupIdeaContext.description}", Target Audience: "${startupIdeaContext.targetAudience}"]\n\n`;
  return contextPrefix + userMessage;
}

function renderMessages() {
  chatArea.innerHTML = '';
  if (chatHistory.length === 0) {
    welcomeState.style.display = 'flex';
    chatArea.appendChild(welcomeState);
    return;
  }
  welcomeState.style.display = 'none';
  chatHistory.forEach(msg => {
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${msg.role === 'user' ? 'message-user ml-auto' : 'message-ai mr-auto'}`;
    bubble.innerHTML = msg.content.replace(/\n/g, '<br>');
    chatArea.appendChild(bubble);
  });
  chatArea.scrollTop = chatArea.scrollHeight;
}

function showTypingIndicator(show = true) {
  typingIndicator.classList.toggle('hidden', !show);
}

function addMessage(role, content) {
  chatHistory.push({ role, content });
  renderMessages();
}

function setInputValue(val) {
  chatInput.value = val;
  chatInput.focus();
}

// Suggestion card click
suggestionCards.forEach(card => {
  card.addEventListener('click', () => {
    setInputValue(card.dataset.suggestion);
  });
});

// Send message
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  addMessage('user', message);
  chatInput.value = '';
  showTypingIndicator(true);
  await getAIResponse(message);
});

// Enter key sends message
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

// Animated send button
sendBtn.addEventListener('mousedown', () => {
  sendBtn.classList.add('animate-bounce-once');
});
sendBtn.addEventListener('animationend', () => {
  sendBtn.classList.remove('animate-bounce-once');
});

// Mic button (voice input using Web Speech API)
micBtn.addEventListener('click', async () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    alert('Voice input is not supported in your browser. Please use Chrome, Edge, or Firefox.');
    console.error('SpeechRecognition not supported');
    return;
  }
  
  try {
    // Request microphone permission
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop()); // Stop the stream, we just needed permission
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    console.log('Starting speech recognition...');
    micBtn.style.opacity = '0.7';
    micBtn.style.background = 'rgba(239, 68, 68, 0.4)';
    micBtn.style.borderColor = 'rgba(239, 68, 68, 0.7)';
    micBtn.innerHTML = '<span style="font-size: 1.5em; animation: pulse 1s infinite;">🎙️</span>';
    
    recognition.onstart = () => {
      console.log('Speech recognition started - listening now...');
    };
    
    recognition.onend = () => {
      console.log('Speech recognition ended');
      micBtn.style.opacity = '1';
      micBtn.style.background = 'rgba(59, 130, 246, 0.1)';
      micBtn.style.borderColor = 'rgba(59, 130, 246, 0.3)';
      micBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="mic-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 16.91c-1.48 1.46-3.51 2.36-5.77 2.36-2.26 0-4.29-.9-5.77-2.36l-1.1 1.1c1.84 1.84 4.35 2.94 6.87 2.94s5.03-1.1 6.87-2.94l-1.1-1.1zM20 9h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-1.26.9-2.62.9-4.05z"/><path d="M4 9c0 1.45.34 2.8.9 4.05l1.23-1.23c-.27-.62-.43-1.31-.43-2.05H4z"/></svg>';
    };
    
    recognition.onresult = (event) => {
      console.log('Speech recognition result:', event);
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const isFinal = event.results[i].isFinal;
        transcript += event.results[i][0].transcript;
        console.log(`Result ${i}: ${event.results[i][0].transcript} (final: ${isFinal})`);
      }
      if (transcript) {
        chatInput.value = transcript;
        chatInput.focus();
        console.log('Transcript set to input:', transcript);
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      alert('Microphone error: ' + event.error + '\n\nTry: 1) Allowing microphone access, 2) Checking privacy settings');
    };
    
    recognition.start();
  } catch (err) {
    console.error('Error getting microphone access:', err);
    if (err.name === 'NotAllowedError') {
      alert('❌ Microphone access denied!\n\nPlease:\n1. Click the camera/mic icon in your address bar\n2. Allow microphone access\n3. Try again');
    } else if (err.name === 'NotFoundError') {
      alert('❌ No microphone found on your device');
    } else {
      alert('❌ Microphone error: ' + err.message);
    }
  }
});

// Fetch AI response
async function getAIResponse(userMessage) {
  try {
    const enhancedMessage = enhanceMessageWithContext(userMessage);
    console.log('Sending message to /api/chat:', enhancedMessage);
    
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: enhancedMessage })
    });
    
    showTypingIndicator(false);
    
    const data = await res.json();
    console.log('Response from /api/chat:', res.status, data);
    
    if (!res.ok) {
      console.error('API error:', data.error || 'Unknown error');
      addMessage('ai', data.error || 'Sorry, I could not process your request.');
      return;
    }
    
    const aiResponse = data.reply || data.response || 'No response received.';
    console.log('AI Response:', aiResponse);
    
    // Typing animation
    await typeAIMessage(aiResponse);
  } catch (err) {
    showTypingIndicator(false);
    console.error('Fetch error:', err);
    addMessage('ai', 'Network error. Please try again.');
  }
}

// Typing animation for AI response
async function typeAIMessage(text) {
  let displayed = '';
  addMessage('ai', '');
  const idx = chatHistory.length - 1;
  for (let i = 0; i < text.length; i++) {
    displayed += text[i];
    chatHistory[idx].content = displayed;
    renderMessages();
    await new Promise(r => setTimeout(r, 12 + Math.random() * 18));
  }
  renderMessages();
}

// Initial render and context loading
loadStartupIdeaContext();
renderMessages();
