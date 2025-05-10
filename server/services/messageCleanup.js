// server/services/messageCleanup.js
const admin = require('firebase-admin');
const cron = require('node-cron');

// Constants
const MESSAGE_LIMIT = 15; // Maximum number of messages to keep

// Initialize message cleanup service
const initMessageCleanupService = () => {
  // Schedule the message limit enforcement to run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running scheduled message limit enforcement...');
    try {
      await enforceMessageLimit();
      console.log('Message limit enforcement completed successfully');
    } catch (error) {
      console.error('Error during message limit enforcement:', error);
    }
  });

  // Set up a database trigger for real-time message limit enforcement
  setupMessageLimitTrigger();
};

// Function to set up a trigger that watches for new messages and enforces limits
const setupMessageLimitTrigger = () => {
  const messagesRef = admin.database().ref('globalMessages');
  
  // Watch for child_added events
  messagesRef.on('child_added', async (snapshot) => {
    try {
      // Get the count of messages
      const countSnapshot = await messagesRef.once('value');
      const messageCount = countSnapshot.numChildren();
      
      // If we exceed the limit, enforce it immediately
      if (messageCount > MESSAGE_LIMIT) {
        console.log(`New message added, total count: ${messageCount}, enforcing limit...`);
        await enforceMessageLimit();
      }
    } catch (error) {
      console.error('Error in real-time message limit enforcement:', error);
    }
  });
};

// Function to enforce the message limit
const enforceMessageLimit = async () => {
  // Get reference to global messages
  const messagesRef = admin.database().ref('globalMessages');
  
  // Get all messages
  const messagesSnapshot = await messagesRef
    .orderByChild('timestamp')
    .once('value');
  
  if (!messagesSnapshot.exists()) {
    return;
  }
  
  // Convert snapshot to array for easier processing
  const messages = [];
  messagesSnapshot.forEach((childSnapshot) => {
    messages.push({
      key: childSnapshot.key,
      timestamp: childSnapshot.val().timestamp
    });
  });
  
  // Sort messages by timestamp (oldest first)
  messages.sort((a, b) => {
    return new Date(a.timestamp) - new Date(b.timestamp);
  });
  
  // Check if we exceed the limit
  if (messages.length > MESSAGE_LIMIT) {
    // Calculate how many messages to delete
    const excessMessages = messages.length - MESSAGE_LIMIT;
    
    // Get the keys of the oldest messages to delete
    const keysToDelete = messages
      .slice(0, excessMessages)
      .map(message => message.key);
    
    // Create the deletion object
    const deletions = {};
    keysToDelete.forEach(key => {
      deletions[key] = null;
    });
    
    // Delete the excess messages
    await messagesRef.update(deletions);
    console.log(`Enforced message limit: deleted ${excessMessages} messages to maintain limit of ${MESSAGE_LIMIT}`);
  }
};

module.exports = {
  initMessageCleanupService,
  enforceMessageLimit
};