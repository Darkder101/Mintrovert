// src/utils/messageLimitUtils.js
import { rtdb } from '../firebase/config';
import { ref, get, remove, query, orderByChild } from 'firebase/database';

// Constants
export const MESSAGE_LIMIT = 30; // Maximum number of messages to keep

/**
 * Enforces the message limit for global chat by deleting oldest messages if needed
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
    
    // Delete each old message
    for (const message of messagesToDelete) {
      const messageRef = ref(rtdb, `globalMessages/${message.id}`);
      await remove(messageRef);
    }
    
    console.log(`Deleted ${messagesToDelete.length} old messages to maintain limit of ${MESSAGE_LIMIT}`);
    return messagesToDelete.length;
  }
  
  return 0;
};