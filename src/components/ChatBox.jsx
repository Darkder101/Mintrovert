import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatBox.module.css';
import MessageBubble from './MessageBubble';
import { useAuth } from '../context/AuthContext';
import { rtdb } from '../firebase/config';
import { ref, push, onValue, get, query, orderByChild } from 'firebase/database';
import { getDisplayName } from '../hooks/useAnonName'; // Import the helper function
import { enforceMessageLimit } from '../utils/messageLimitUtils'; // Import the message limit utility

const ChatBox = ({ user, conversationId, messages: initialMessages = [] }) => {
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState(initialMessages);
  const [senderNames, setSenderNames] = useState({}); // Store anonymous names
  const messagesEndRef = useRef(null);
  const { currentUser, anonName } = useAuth();
  
  // Fetch sender anonymous names
  useEffect(() => {
    const fetchSenderNames = async () => {
      const nameCache = {};
      
      // Get current user's anon name
      if (currentUser) {
        nameCache[currentUser.uid] = anonName || await getDisplayName(currentUser.uid);
      }
      
      // Get other user's anon name if applicable
      if (user?.uid) {
        nameCache[user.uid] = await getDisplayName(user.uid);
      }
      
      // Get names for all message senders
      for (const message of messages) {
        const senderId = message.sender || message.userId;
        if (senderId && !nameCache[senderId]) {
          nameCache[senderId] = await getDisplayName(senderId);
        }
      }
      
      setSenderNames(nameCache);
    };
    
    fetchSenderNames();
  }, [currentUser, user, messages, anonName]);
  
  // Listen for messages from Firebase
  useEffect(() => {
    if (!conversationId) return;
    
    const messagesRef = ref(rtdb, `privateMessages/${conversationId}`);
    const messagesQuery = query(messagesRef, orderByChild('timestamp'));
    
    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      if (snapshot.exists()) {
        const messagesData = snapshot.val();
        const messageList = Object.keys(messagesData).map(key => ({
          id: key,
          ...messagesData[key]
        }));
        
        // Sort messages by timestamp
        messageList.sort((a, b) => {
          return new Date(a.timestamp) - new Date(b.timestamp);
        });
        
        setMessages(messageList);
      }
    });
    
    return () => unsubscribe();
  }, [conversationId]);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !currentUser) return;
    
    const messageData = {
      sender: currentUser.uid,
      senderName: currentUser.displayName || 'User',
      senderAnonName: anonName || 'Anonymous User', // Add anonymous name
      receiver: user?.uid || '',
      text: newMessage,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    try {
      // Push message to Firebase
      if (conversationId) {
        const messagesRef = ref(rtdb, `privateMessages/${conversationId}`);
        await push(messagesRef, messageData);
        
        // Check if we need to enforce message limit for private messages
        const snapshot = await get(messagesRef);
        if (snapshot.exists()) {
          const messageCount = Object.keys(snapshot.val()).length;
          if (messageCount > 100) { // Using a higher limit for private chats
            await enforcePrivateMessageLimit(conversationId);
          }
        }
      } else {
        // For global chat
        const messagesRef = ref(rtdb, 'globalMessages');
        await push(messagesRef, {
          userId: currentUser.uid,
          username: currentUser.displayName || 'User',
          anonName: anonName || 'Anonymous User', // Add anonymous name
          text: newMessage,
          type: 'text',
          timestamp: new Date().toISOString()
        });
        
        // Enforce message limit after sending to global chat
        await enforceMessageLimit();
      }
      
      // Clear input field
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
      // Optionally show an error message to the user
    }
  };

  // Helper function to enforce message limit for private conversations
  const enforcePrivateMessageLimit = async (convId) => {
    const PRIVATE_MESSAGE_LIMIT = 100; // Higher limit for private conversations
    
    const messagesRef = ref(rtdb, `privateMessages/${convId}`);
    const messagesQuery = query(messagesRef, orderByChild('timestamp'));
    const snapshot = await get(messagesQuery);
    
    if (!snapshot.exists()) {
      return 0;
    }
    
    // Convert snapshot to array for easier processing
    const messagesList = [];
    snapshot.forEach((childSnapshot) => {
      messagesList.push({
        id: childSnapshot.key,
        timestamp: childSnapshot.val().timestamp
      });
    });
    
    // Sort messages by timestamp (oldest first)
    messagesList.sort((a, b) => {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
    
    // Check if we exceed the limit
    if (messagesList.length > PRIVATE_MESSAGE_LIMIT) {
      // Calculate how many messages to delete
      const excessMessages = messagesList.length - PRIVATE_MESSAGE_LIMIT;
      const messagesToDelete = messagesList.slice(0, excessMessages);
      
      // Delete excess messages one by one
      const updates = {};
      messagesToDelete.forEach(msg => {
        updates[`privateMessages/${convId}/${msg.id}`] = null;
      });
      
      // Perform the batch delete
      const rootRef = ref(rtdb);
      await update(rootRef, updates);
      
      console.log(`Deleted ${excessMessages} old messages from private conversation to maintain limit`);
      return excessMessages;
    }
    
    return 0;
  };

  return (
    <div className={styles.chatBox}>
      <div className={styles.messagesList}>
        {messages.map(message => {
          const senderId = message.sender || message.userId;
          const isOwn = senderId === currentUser?.uid;
          const senderAnonName = message.senderAnonName || 
                               message.anonName || 
                               senderNames[senderId] || 
                               message.senderName || 
                               message.username || 
                               'Anonymous';
          
          return (
            <MessageBubble
              key={message.id}
              message={{
                ...message,
                senderAnonName // Pass anonymous name to the bubble
              }}
              isOwn={isOwn}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <form className={styles.inputArea} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Type here..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className={styles.messageInput}
        />
        <button type="submit" className={styles.sendButton}>
          <span>→</span>
        </button>
      </form>
    </div>
  );
};

export default ChatBox;