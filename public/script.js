const socket = io();
let username = "";

const loginScreen = document.getElementById("loginScreen");
const chatScreen = document.getElementById("chatScreen");
const nameInput = document.getElementById("nameInput");
const passwordInput = document.getElementById("passwordInput");
const errorMsg = document.getElementById("errorMsg");

const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");

// 🔐 Join chat securely
function enterChat() {
  const enteredName = nameInput.value.trim();
  const enteredPassword = passwordInput.value.trim();

  if (!enteredName || !enteredPassword) {
    errorMsg.textContent = "Please enter both name and password.";
    return;
  }

  username = enteredName;

  socket.emit("join", { username, password: enteredPassword });
}

// 🛑 Handle authentication failure
socket.on("auth_error", (msg) => {
  errorMsg.textContent = msg;
});

// ✅ On successful connection, show chat screen
socket.on("join_success", () => {
  loginScreen.style.display = "none";
  chatScreen.style.display = "block";
});

// 📤 Send message
function sendMessage() {
  const msg = messageInput.value.trim();
  if (msg !== "") {
    socket.emit("chat message", { sender: username, msg });
    messageInput.value = "";
  }
}

// 📥 Receive messages
socket.on("chat message", ({ sender, msg, timestamp, isSystem }) => {
  const msgElem = document.createElement("div");

  if (isSystem) {
    msgElem.className = "message system";
    msgElem.innerHTML = `<em>${msg}</em><div class="timestamp">${timestamp}</div>`;
  } else {
    const isSelf = sender === username;
    msgElem.className = `message ${isSelf ? "sent" : "received"}`;
    msgElem.innerHTML = `<strong>${sender}</strong>: ${msg}<div class="timestamp">${timestamp}</div>`;
  }

  messagesDiv.appendChild(msgElem);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// Handle mobile keyboard visibility
messageInput.addEventListener('focus', () => {
  // Scroll messages to bottom when input is focused
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  
  // Add a small delay to ensure keyboard is fully open
  setTimeout(() => {
    // Scroll input into view
    document.getElementById('chatInputContainer').scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
  }, 300);
});

// Also ensure we scroll to bottom when new messages arrive
socket.on('chat message', () => {
  setTimeout(() => {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, 100);
});

// Handle Enter key for login form
nameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    enterChat();
  }
});

passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    enterChat();
  }
});

// Handle Enter key for message input
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});