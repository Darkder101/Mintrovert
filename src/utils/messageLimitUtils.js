// src/utils/messageLimitUtils.js
import { rtdb } from '../firebase/config';
import { ref, get, update, query, orderByChild } from 'firebase/database';

// Constants
export const MESSAGE_LIMIT = 30; // Maximum number of messages to keep

/**
 * Enforces the message limit for global chat by deleting oldest messages if needed
 * This is a client-side fallback for the server-side enforcement
 * @returns {Promise<number>} Number of deleted messages
 */
export const enforceMessageLimit = async () => {
  const messagesRef = ref(rtdb, 'globalMessages');
  const messagesQuery = query(messagesRef, orderByChild('timestamp'));
  const snapshot = await get(messagesQuery);
  
  if (!snapshot.exists()) {
    return 0;
  }
  
  // Convert snapshot to array for easier processing
  const messages = [];
  snapshot.forEach((childSnapshot) => {
    messages.push({
      id: childSnapshot.key,
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
    const messagesToDelete = messages.slice(0, messages.length - MESSAGE_LIMIT);
    
    // Create a batch update to delete all messages at once
    const updates = {};
    
    // Add each message to delete to the updates object
    for (const message of messagesToDelete) {
      updates[`globalMessages/${message.id}`] = null;
    }
    
    // Perform the batch delete operation
    const rootRef = ref(rtdb);
    await update(rootRef, updates);
    
    console.log(`Deleted ${messagesToDelete.length} old messages to maintain limit of ${MESSAGE_LIMIT}`);
    return messagesToDelete.length;
  }
  
  return 0;
};