// server/services/messageCleanup.js
const admin = require('firebase-admin');
const cron = require('node-cron');

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
};

// Function to clean up messages older than 24 hours
const cleanupGlobalMessages = async () => {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - 24);
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

module.exports = {
  initMessageCleanupService,
  cleanupGlobalMessages
};