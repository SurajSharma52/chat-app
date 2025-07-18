const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");

// Environment variables (Render injects these)
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Crash immediately if MongoDB URI is missing
if (!MONGODB_URI) {
  console.warn("Running in memory-only mode (no database)");
  // Create mock database functions
  const mockDB = {
    find: () => Promise.resolve([]),
    create: () => Promise.resolve({}),
  };
  module.exports = { Message: mockDB };
}
// MongoDB connection with retries
const connectWithRetry = () => {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => {
      console.error("❌ MongoDB connection failed, retrying in 5 seconds...", err);
      setTimeout(connectWithRetry, 5000);
    });
};
connectWithRetry();

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
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins (adjust in production)
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Simple user store (Replace with a proper DB in production)
const users = {
  user1: "pass123",
  user2: "hello456",
  friend: "chat789"
};

const connectedUsers = {};

function getCurrentTimestamp() {
  return new Date().toLocaleTimeString();
}

// Socket.io logic (same as original)
io.on("connection", (socket) => {
  let currentUsername = "";

  socket.on("join", async ({ username, password }) => {
    if (users[username] && users[username] === password) {
      currentUsername = username;
      connectedUsers[socket.id] = username;

      const history = await Message.find().sort({ createdAt: -1 }).limit(100).lean();
      socket.emit("message_history", history.reverse());

      const systemMsg = {
        sender: "System",
        msg: `${username} joined the chat`,
        timestamp: getCurrentTimestamp(),
        isSystem: true
      };
      await Message.create(systemMsg);
      socket.broadcast.emit("chat message", systemMsg);
      socket.emit("join_success");
    } else {
      socket.emit("auth_error", "Invalid credentials");
    }
  });

  socket.on("chat message", async ({ sender, msg }) => {
    const messageObj = {
      sender,
      msg,
      timestamp: getCurrentTimestamp(),
      isSystem: false
    };
    await Message.create(messageObj);
    io.emit("chat message", messageObj);
  });

  socket.on("disconnect", async () => {
    if (currentUsername) {
      const systemMsg = {
        sender: "System",
        msg: `${currentUsername} left the chat`,
        timestamp: getCurrentTimestamp(),
        isSystem: true
      };
      await Message.create(systemMsg);
      socket.broadcast.emit("chat message", systemMsg);
    }
  });
});

// Health check endpoint for Render
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
