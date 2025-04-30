import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatBox.module.css';
import MessageBubble from './MessageBubble';
import { useAuth } from '../context/AuthContext';
import { rtdb } from '../firebase/config';
import { ref, push, onValue } from 'firebase/database';
import { getDisplayName } from '../hooks/useAnonName'; // Import the helper function

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
    const unsubscribe = onValue(messagesRef, (snapshot) => {
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

  const handleSubmit = (e) => {
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
    
    // Push message to Firebase
    if (conversationId) {
      const messagesRef = ref(rtdb, `privateMessages/${conversationId}`);
      push(messagesRef, messageData);
    } else {
      // For global chat
      const messagesRef = ref(rtdb, 'globalMessages');
      push(messagesRef, {
        userId: currentUser.uid,
        username: currentUser.displayName || 'User',
        anonName: anonName || 'Anonymous User', // Add anonymous name
        text: newMessage,
        type: 'text',
        timestamp: new Date().toISOString()
      });
    }
    
    // Clear input field
    setNewMessage('');
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