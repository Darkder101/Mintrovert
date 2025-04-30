const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const confessionRoutes = require('./routes/confessions');
const { initMessageCleanupService } = require('./services/messageCleanup');

// Initialize Firebase admin - with conditional for service account
let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://weconnect-e2c85-default-rtdb.firebaseio.com/' // Your Firebase DB URL
  });
} catch (error) {
  console.warn('Firebase service account not found, running without Firebase admin initialization');
  // You might want to add alternative initialization here if needed
}

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server using Express app
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*", // In production, restrict this to your frontend domain
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/confessions', confessionRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Initialize message cleanup service
if (typeof initMessageCleanupService === 'function') {
  initMessageCleanupService();
}

// Store connected users
const connectedUsers = {};

// Roulette Chat Queue and Pairs
let rouletteQueue = [];
let chatPairs = new Map();

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('New client connected', socket.id);
  
  // Immediately emit current user count when a new user connects
  io.emit('users_list', Object.values(connectedUsers));
  
  // Join global chat
  socket.on('join_global_chat', (userData) => {
    console.log(`User ${userData.userId} joined global chat`, userData);
    
    // Add user to the connectedUsers map
    connectedUsers[userData.userId] = {
      socketId: socket.id,
      userId: userData.userId,
      username: userData.username,
      avatarColor: userData.avatarColor || getRandomColor()
    };
    
    // Join the global chat room
    socket.join('global_chat');
    
    // Broadcast updated user list to all clients
    io.emit('users_list', Object.values(connectedUsers));
  });
  
  // Global chat handlers
  socket.on('sendMessage', (messageData) => {
    console.log(`Message received from ${messageData.userId}: ${messageData.text}`, messageData);
    // Broadcast the message to all users in global chat
    io.to('global_chat').emit('receiveMessage', messageData);
  });
  
  socket.on('sendImage', (imageData) => {
    console.log(`Image received from ${imageData.userId}`);
    // Broadcast the image to all users in global chat
    io.to('global_chat').emit('receiveImage', imageData);
  });
  
  socket.on('sendPoll', (pollData) => {
    console.log(`Poll received from ${pollData.userId}`);
    // Broadcast the poll to all users in global chat
    io.to('global_chat').emit('receivePoll', pollData);
  });
  
  socket.on('updatePoll', (pollUpdate) => {
    console.log(`Poll update received`);
    io.to('global_chat').emit('pollUpdated', pollUpdate);
  });
  
  // Private chat handlers
  socket.on('user_connected', (user) => {
    // Store user socket mapping
    connectedUsers[user.id] = {
      socketId: socket.id,
      username: user.username,
      avatarColor: user.avatarColor || getRandomColor(),
      id: user.id
    };
    
    // Send the updated user list to all clients
    io.emit('users_list', Object.values(connectedUsers));
  });

  // Handle private messages
  socket.on('private_message', (data) => {
    const { to, message } = data;
    const sender = Object.keys(connectedUsers).find(
      userId => connectedUsers[userId].socketId === socket.id
    );
    
    if (sender && connectedUsers[to]) {
      // Send to recipient
      io.to(connectedUsers[to].socketId).emit('private_message', {
        from: sender,
        message: message
      });
    }
  });
  
  // Add user to private chat
  socket.on('add_to_private_chat', (userData) => {
    console.log(`Adding user ${userData.targetId} to private chat with ${userData.userId}`);
    
    // Let the target user know they've been added to private chat
    if (connectedUsers[userData.targetId]) {
      io.to(connectedUsers[userData.targetId].socketId).emit('added_to_private_chat', {
        userId: userData.userId,
        username: userData.username
      });
    }
  });
  
  // ROULETTE CHAT HANDLERS
  socket.on('join_roulette', ({ userId, username }) => {
    console.log(`User ${username} (${userId}) joined roulette queue`);
    
    // Store user info in socket
    socket.userId = userId;
    socket.username = username;
    
    // Check if this user was in a chat before
    if (chatPairs.has(userId)) {
      const oldPartnerId = chatPairs.get(userId);
      chatPairs.delete(userId);
      chatPairs.delete(oldPartnerId);
      
      // Notify the old partner that this user disconnected
      const oldPartnerSocket = findSocketByUserId(oldPartnerId);
      if (oldPartnerSocket) {
        oldPartnerSocket.emit('partner_disconnected');
      }
    }
    
    // Remove user from queue if they were already in it
    rouletteQueue = rouletteQueue.filter(user => user.userId !== userId);
    
    // If queue is empty, add user to queue
    if (rouletteQueue.length === 0) {
      rouletteQueue.push({ userId, username, socketId: socket.id });
      socket.emit('waiting');
    } else {
      // Match with the first user in the queue
      const partner = rouletteQueue.shift();
      
      // Create chat pair
      chatPairs.set(userId, partner.userId);
      chatPairs.set(partner.userId, userId);
      
      // Notify both users of the match
      socket.emit('matched', { 
        partnerId: partner.userId, 
        partnerName: partner.username 
      });
      
      const partnerSocket = findSocketByUserId(partner.userId);
      if (partnerSocket) {
        partnerSocket.emit('matched', { 
          partnerId: userId, 
          partnerName: username 
        });
      }
    }
  });
  
  // Send message to roulette chat partner
  socket.on('send_message', ({ to, text }) => {
    const partnerSocket = findSocketByUserId(to);
    if (partnerSocket) {
      partnerSocket.emit('receive_message', {
        text,
        from: socket.userId
      });
    }
  });
  
  // Skip current partner and find a new one
  socket.on('skip_partner', () => {
    if (!socket.userId) return;
    
    if (chatPairs.has(socket.userId)) {
      const partnerId = chatPairs.get(socket.userId);
      
      // Remove both users from the chat pair
      chatPairs.delete(socket.userId);
      chatPairs.delete(partnerId);
      
      // Notify partner that this user disconnected
      const partnerSocket = findSocketByUserId(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partner_disconnected');
      }
    }
    
    // Add user back to the queue
    socket.emit('waiting');
    rouletteQueue.push({ 
      userId: socket.userId, 
      username: socket.username, 
      socketId: socket.id 
    });
    
    // Try to match with another user in the queue
    matchUsers();
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    
    // Find and remove the disconnected user from regular chat
    const userId = Object.keys(connectedUsers).find(
      id => connectedUsers[id].socketId === socket.id
    );
    
    if (userId) {
      delete connectedUsers[userId];
      // Send updated user list
      io.emit('users_list', Object.values(connectedUsers));
    }
    
    // Handle roulette chat disconnection
    if (socket.userId) {
      // Remove from queue if in queue
      rouletteQueue = rouletteQueue.filter(user => user.userId !== socket.userId);
      
      // Notify partner if in a chat pair
      if (chatPairs.has(socket.userId)) {
        const partnerId = chatPairs.get(socket.userId);
        chatPairs.delete(socket.userId);
        chatPairs.delete(partnerId);
        
        const partnerSocket = findSocketByUserId(partnerId);
        if (partnerSocket) {
          partnerSocket.emit('partner_disconnected');
        }
      }
    }
  });
});

// Helper function for random colors
function getRandomColor() {
  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Helper function to find a socket by user ID
function findSocketByUserId(userId) {
  const sockets = io.sockets.sockets;
  for (const [socketId, socket] of sockets) {
    if (socket.userId === userId) {
      return socket;
    }
  }
  
  // If not found by socket.userId, try through connectedUsers
  if (connectedUsers[userId]) {
    const socketId = connectedUsers[userId].socketId;
    return io.sockets.sockets.get(socketId);
  }
  
  return null;
}

// Helper function to match users in the queue
function matchUsers() {
  while (rouletteQueue.length >= 2) {
    const user1 = rouletteQueue.shift();
    const user2 = rouletteQueue.shift();
    
    // Add users to chat pairs
    chatPairs.set(user1.userId, user2.userId);
    chatPairs.set(user2.userId, user1.userId);
    
    // Find both sockets
    const socket1 = findSocketByUserId(user1.userId);
    const socket2 = findSocketByUserId(user2.userId);
    
    // Notify both users
    if (socket1) {
      socket1.emit('matched', { 
        partnerId: user2.userId, 
        partnerName: user2.username 
      });
    }
    
    if (socket2) {
      socket2.emit('matched', { 
        partnerId: user1.userId, 
        partnerName: user1.username 
      });
    }
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Change from app.listen to server.listen for Socket.io
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export admin for other files
module.exports = { admin, io };