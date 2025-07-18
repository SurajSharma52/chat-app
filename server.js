const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");

// Configuration - uses Render environment variables
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://surajsharma97336:JpyjEs522ewfeVJ3@chatapp.nkfy6z9.mongodb.net/?retryWrites=true&w=majority&appName=chatapp";
const PORT = process.env.PORT || 3000;

// Initialize MongoDB connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch(err => {
  console.error("❌ MongoDB connection error:", err);
  process.exit(1); // Exit if DB connection fails
});

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: String,
  msg: String,
  timestamp: String,
  isSystem: Boolean
}, { timestamps: true });

const Message = mongoose.model("Message", messageSchema);

// App setup
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Predefined users (move to DB in production)
const users = {
  user1: "pass123",
  user2: "hello456", 
  friend: "chat789"
};

// Active connections
const connectedUsers = {};

// Helper functions
function getCurrentTimestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Socket.io handlers
io.on("connection", (socket) => {
  let currentUsername = "";

  socket.on("join", async ({ username, password }) => {
    if (users[username] && users[username] === password) {
      currentUsername = username;
      connectedUsers[socket.id] = username;

      try {
        // Send message history
        const history = await Message.find()
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();
        socket.emit("message_history", history.reverse());

        // Notify others
        const systemMsg = {
          sender: "System",
          msg: `${username} joined the chat.`,
          timestamp: getCurrentTimestamp(),
          isSystem: true
        };
        await Message.create(systemMsg);
        socket.broadcast.emit("chat message", systemMsg);
        
        socket.emit("join_success");
      } catch (err) {
        console.error("Login error:", err);
        socket.emit("auth_error", "Server error during login");
      }
    } else {
      socket.emit("auth_error", "Invalid username or password.");
    }
  });

  socket.on("chat message", async ({ sender, msg }) => {
    if (!sender || !msg) return;
    
    try {
      const messageObj = {
        sender,
        msg,
        timestamp: getCurrentTimestamp(),
        isSystem: false
      };
      await Message.create(messageObj);
      io.emit("chat message", messageObj);
    } catch (err) {
      console.error("Message save error:", err);
    }
  });

  socket.on("disconnect", async () => {
    const username = connectedUsers[socket.id];
    if (username) {
      delete connectedUsers[socket.id];
      const systemMsg = {
        sender: "System",
        msg: `${username} left the chat.`,
        timestamp: getCurrentTimestamp(),
        isSystem: true
      };
      await Message.create(systemMsg);
      socket.broadcast.emit("chat message", systemMsg);
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Using MongoDB URI: ${MONGODB_URI.substring(0, 30)}...`); // Log partial URI
});
