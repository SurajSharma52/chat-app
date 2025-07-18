const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
const fs = require("fs"); // Add this line at the top with other requires
require("dotenv").config({ path: path.resolve(__dirname, '.env') });

// Debug code moved after all requires
console.log('--- DEBUG START ---');
console.log('Current .env path:', path.resolve(__dirname, '.env'));
console.log('File exists:', fs.existsSync(path.resolve(__dirname, '.env')));
console.log('File content:', fs.readFileSync(path.resolve(__dirname, '.env'), 'utf8'));
console.log('MONGODB_URI from env:', process.env.MONGODB_URI);
console.log('PORT from env:', process.env.PORT);
console.log('Current directory:', __dirname);
console.log('.env exists?', fs.existsSync('.env'));
console.log('.env content:', fs.readFileSync('.env', 'utf8'));
console.log('--- DEBUG END ---');

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://surajsharma97336:JpyjEs522ewfeVJ3@chatapp.nkfy6z9.mongodb.net/?retryWrites=true&w=majority&appName=chatapp";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);


// Then your existing mongoose.connect:
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: String,
  msg: String,
  timestamp: String,
  isSystem: Boolean
}, { timestamps: true });

const Message = mongoose.model("Message", messageSchema);

// Predefined user credentials (can be moved to database later)
const users = {
  user1: "pass123",
  user2: "hello456",
  friend: "chat789"
};

// Store connected users
const connectedUsers = {};

// Get current timestamp
function getCurrentTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Handle socket connections
io.on("connection", (socket) => {
  let currentUsername = "";

  // Handle login/join attempt
  socket.on("join", async ({ username, password }) => {
    if (users[username] && users[username] === password) {
      currentUsername = username;
      connectedUsers[socket.id] = username;

      try {
        // Get last 100 messages from database (newest first)
        const history = await Message.find()
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();
        
        // Send history to the joining user (oldest first)
        socket.emit("message_history", history.reverse());

        socket.emit("join_success");
        
        // Notify others
        const systemMsg = {
          sender: "System",
          msg: `${username} joined the chat.`,
          timestamp: getCurrentTimestamp(),
          isSystem: true
        };
        
        // Save system message
        await Message.create(systemMsg);
        socket.broadcast.emit("chat message", systemMsg);

      } catch (err) {
        console.error("Error handling join:", err);
        socket.emit("auth_error", "Server error during login");
      }

    } else {
      socket.emit("auth_error", "Invalid username or password.");
    }
  });

  // Handle chat message
  socket.on("chat message", async ({ sender, msg }) => {
    if (!sender || !msg) return;

    try {
      const timestamp = getCurrentTimestamp();
      const messageObj = {
        sender,
        msg,
        timestamp,
        isSystem: false
      };

      // Save to database
      await Message.create(messageObj);
      
      // Broadcast to all clients
      io.emit("chat message", messageObj);

    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    const username = connectedUsers[socket.id];
    if (username) {
      delete connectedUsers[socket.id];
      
      try {
        const systemMsg = {
          sender: "System",
          msg: `${username} left the chat.`,
          timestamp: getCurrentTimestamp(),
          isSystem: true
        };
        
        // Save system message
        await Message.create(systemMsg);
        socket.broadcast.emit("chat message", systemMsg);
        
      } catch (err) {
        console.error("Error handling disconnect:", err);
      }
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

console.log('.env file contents:');
console.log(fs.readFileSync('./.env', 'utf8'));