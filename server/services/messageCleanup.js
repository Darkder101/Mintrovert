// server/services/messageCleanup.js
const admin = require('firebase-admin');
const cron = require('node-cron');

// Constants
const MESSAGE_LIMIT = 30; // Maximum number of messages to keep
const MESSAGE_RETENTION_HOURS = 24; // Keep messages for 24 hours

// Initialize message cleanup service
const initMessageCleanupService = () => {
  // Schedule the cleanup to run every day at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('Running scheduled global message cleanup...');
    try {
      await cleanupGlobalMessages();
      console.log('Global message cleanup completed successfully');
    } catch (error) {
      console.error('Error during global message cleanup:', error);
    }
  });
  
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
};

// Function to clean up messages older than 24 hours
const cleanupGlobalMessages = async () => {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - MESSAGE_RETENTION_HOURS);
  const cutoffTimeISO = cutoffTime.toISOString();
  
  // Get reference to global messages
  const messagesRef = admin.database().ref('globalMessages');
  
  // Query for messages older than the cutoff time
  const oldMessagesSnapshot = await messagesRef
    .orderByChild('timestamp')
    .endAt(cutoffTimeISO)
    .once('value');
  
  if (!oldMessagesSnapshot.exists()) {
    return;
  }
  
  // Get the messages to delete
  const messagesToDelete = {};
  oldMessagesSnapshot.forEach((childSnapshot) => {
    messagesToDelete[childSnapshot.key] = null;
  });
  
  // Delete the old messages
  if (Object.keys(messagesToDelete).length > 0) {
    await messagesRef.update(messagesToDelete);
    console.log(`Deleted ${Object.keys(messagesToDelete).length} old global messages`);
  }
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
  cleanupGlobalMessages,
  enforceMessageLimit
};