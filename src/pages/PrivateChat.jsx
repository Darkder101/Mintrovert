import React, { useState, useEffect, useRef } from 'react';
import styles from './PrivateChat.module.css';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { db, rtdb } from '../firebase/config';
import { 
  ref, 
  onValue, 
  push, 
  set, 
  serverTimestamp as rtdbTimestamp,
  query as rtdbQuery,
  orderByChild,
  get,
  update,
  remove,
  off
} from 'firebase/database';
import LoadingSpinner from '../components/LoadingSpinner';
import useAnonName from '../hooks/useAnonName'; // Import the hook for current user
import { getDisplayName } from '../hooks/useAnonName'; // Import the helper function
import { filterSensitiveContent, containsSensitiveContent } from '../utils/filterUtils'; // Import filter functions

const PrivateChat = () => {
  // State variables
  const [selectedChat, setSelectedChat] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [filterWarning, setFilterWarning] = useState(false); // State to track filter warnings
  const { currentUser, anonName } = useAuth(); // Get anonName from context
  
  // Refs
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const unsubscribeRefs = useRef({});
  
  // Store fetched anonymous names
  const [userAnonNames, setUserAnonNames] = useState({});

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch all chats the current user is a part of
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    
    // Reference to all private chats
    const chatsRef = ref(rtdb, 'privateChats');
    
    // Listen for changes to private chats
    const unsubscribe = onValue(chatsRef, async (snapshot) => {
      if (!snapshot.exists()) {
        setChats([]);
        setLoading(false);
        return;
      }
      
      const chatsData = snapshot.val();
      const userChats = [];
      const userIds = new Set(); // To keep track of users we need to fetch anon names for
      
      // Filter out chats that include the current user
      Object.keys(chatsData).forEach(chatId => {
        const chat = chatsData[chatId];
        const participants = chat.participants;
        
        if (participants && participants[currentUser.uid]) {
          // Find the other participant
          const otherUserId = Object.keys(participants).find(id => id !== currentUser.uid);
          
          if (otherUserId) {
            userIds.add(otherUserId); // Add to set of users we need anon names for
            const otherUser = participants[otherUserId];
            const currentUserData = participants[currentUser.uid];
            
            // Check if user is blocked by current user
            const isBlockedByMe = currentUserData.blockedUsers && 
                               currentUserData.blockedUsers[otherUserId];
            
            // Check if current user is blocked by the other user
            const isBlockingMe = otherUser.blockedUsers && 
                               otherUser.blockedUsers[currentUser.uid];
            
            // Only hide if both hidden flag is true
            const isHidden = currentUserData.hidden === true;
            
            // Include blocked chats, but mark them as blocked
            if (!isHidden) {
              userChats.push({
                id: chatId,
                otherUser: {
                  id: otherUserId,
                  displayName: otherUser.displayName || "User",
                  lastSeen: otherUser.lastSeen
                },
                // Filter sensitive content in last message
                lastMessage: chat.lastMessage ? filterSensitiveContent(chat.lastMessage) : '',
                unreadCount: (chat.unreadCount && chat.unreadCount[currentUser.uid]) || 0,
                updatedAt: chat.updatedAt || chat.createdAt,
                isBlocked: isBlockedByMe,
                isBlockingMe: isBlockingMe
              });
            }
          }
        }
      });
      
      // Fetch anonymous names for all users in chats
      const anonNames = {...userAnonNames};
      const userIdsToFetch = Array.from(userIds).filter(id => !anonNames[id]);
      
      if (userIdsToFetch.length > 0) {
        const fetchPromises = userIdsToFetch.map(async (userId) => {
          const anonName = await getDisplayName(userId);
          anonNames[userId] = anonName;
        });
        
        // Wait for all anon names to be fetched
        await Promise.all(fetchPromises);
        setUserAnonNames(anonNames);
      }
      
      // Sort chats by most recent activity
      userChats.sort((a, b) => {
        const timeA = a.updatedAt || 0;
        const timeB = b.updatedAt || 0;
        return timeB - timeA;
      });
      
      setChats(userChats);
      setLoading(false);
    });
    
    // Check for unread messages
    const unreadMessagesRef = ref(rtdb, `unreadPrivateMessages/${currentUser.uid}`);
    const unreadUnsubscribe = onValue(unreadMessagesRef, (snapshot) => {
      if (snapshot.exists()) {
        const unreadData = snapshot.val();
        
        // Update unread counts in chats
        setChats(prevChats => 
          prevChats.map(chat => {
            const senderId = chat.otherUser.id;
            const unreadCount = unreadData[senderId] ? 1 : 0;
            return {
              ...chat,
              unreadCount
            };
          })
        );
      }
    });
    
    // Store unsubscribe functions
    unsubscribeRefs.current.chats = unsubscribe;
    unsubscribeRefs.current.unread = unreadUnsubscribe;
    
    return () => {
      // Clean up listeners when component unmounts
      unsubscribe();
      unreadUnsubscribe();
      
      // Clean up any message listeners
      Object.values(unsubscribeRefs.current).forEach(unsub => {
        if (typeof unsub === 'function') {
          unsub();
        }
      });
    };
  }, [currentUser]);

  // Load messages when selecting a chat
  useEffect(() => {
    if (!selectedChat || !currentUser) return;
    
    // Cleanup previous listeners
    if (unsubscribeRefs.current.messages) {
      unsubscribeRefs.current.messages();
    }
    
    // Reference to messages for this chat
    const messagesRef = ref(rtdb, `messages/${selectedChat.id}`);
    
    // Listen for new messages
    const unsubscribe = onValue(messagesRef, async (snapshot) => {
      if (!snapshot.exists()) {
        setMessages([]);
        return;
      }
      
      const messagesData = snapshot.val();
      let messagesList = Object.keys(messagesData).map(key => ({
        id: key,
        ...messagesData[key],
        // Filter sensitive content in message text
        text: filterSensitiveContent(messagesData[key].text)
      }));
      
      // Get anonymous names for message senders if not already in state
      const senderIds = new Set(messagesList.map(msg => msg.sender));
      const newAnonNames = { ...userAnonNames };
      let needsUpdate = false;
      
      for (const senderId of senderIds) {
        if (!newAnonNames[senderId]) {
          newAnonNames[senderId] = await getDisplayName(senderId);
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        setUserAnonNames(newAnonNames);
      }
      
      // Enhance messages with anonymous names
      messagesList = messagesList.map(msg => ({
        ...msg,
        senderAnonName: newAnonNames[msg.sender] || msg.senderName
      }));
      
      // Sort messages by timestamp
      messagesList.sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeA - timeB;
      });
      
      setMessages(messagesList);
      
      // Mark messages as read (if not blocked)
      if (!selectedChat.isBlockingMe) {
        markMessagesAsRead(selectedChat.id);
      }
    });
    
    // Save unsubscribe function for cleanup
    unsubscribeRefs.current.messages = unsubscribe;
    
    // Update user's last seen (if not blocked)
    if (!selectedChat.isBlockingMe) {
      updateLastSeen(selectedChat.id);
    }
    
    // Focus on input field when changing chats
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 100);
    
    // Clear unread messages flag (if not blocked)
    if (!selectedChat.isBlockingMe) {
      const unreadRef = ref(rtdb, `unreadPrivateMessages/${currentUser.uid}/${selectedChat.otherUser.id}`);
      remove(unreadRef).catch(error => {
        console.error("Error removing unread flag:", error);
      });
    }
    
    return () => {
      // Clean up message listener when changing chats
      if (unsubscribeRefs.current.messages) {
        unsubscribeRefs.current.messages();
      }
    };
  }, [selectedChat, currentUser]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read
  const markMessagesAsRead = async (chatId) => {
    if (!currentUser || !chatId) return;
    
    try {
      const chatRef = ref(rtdb, `privateChats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (chatSnapshot.exists()) {
        const chat = chatSnapshot.val();
        
        // If there are unread messages, mark them as read
        if (chat.unreadCount && chat.unreadCount[currentUser.uid]) {
          const updates = {};
          updates[`unreadCount/${currentUser.uid}`] = 0;
          
          await update(chatRef, updates);
          
          // Also update local state
          setChats(prevChats => 
            prevChats.map(chat => 
              chat.id === chatId 
                ? { ...chat, unreadCount: 0 } 
                : chat
            )
          );
        }
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  // Update user's last seen timestamp
  const updateLastSeen = (chatId) => {
    if (!currentUser || !chatId) return;
    
    const userRef = ref(rtdb, `privateChats/${chatId}/participants/${currentUser.uid}`);
    update(userRef, {
      lastSeen: rtdbTimestamp()
    }).catch(error => {
      console.error("Error updating last seen:", error);
    });
  };

  const handleUserSelect = (chat) => {
    setSelectedChat(chat);
    
    // Mark messages as read when selecting a chat (if not blocked)
    if (chat && chat.unreadCount > 0 && !chat.isBlockingMe) {
      markMessagesAsRead(chat.id);
    }
    
    // Clear unread flag (if not blocked)
    if (currentUser && chat && !chat.isBlockingMe) {
      const unreadRef = ref(rtdb, `unreadPrivateMessages/${currentUser.uid}/${chat.otherUser.id}`);
      remove(unreadRef).catch(error => {
        console.error("Error removing unread flag:", error);
      });
    }
  };

  const handleBackToList = () => {
    setSelectedChat(null);
  };

  const handleSendMessage = async () => {
    const text = messageInput.trim();
    if (!selectedChat || !text || !currentUser || selectedChat.isBlocked || selectedChat.isBlockingMe) return;
    
    // Check if message contains sensitive content
    const hasSensitiveContent = containsSensitiveContent(text);
    if (hasSensitiveContent) {
      // Show warning briefly
      setFilterWarning(true);
      setTimeout(() => setFilterWarning(false), 3000);
    }
    
    // Filter the message text
    const filteredText = filterSensitiveContent(text);
    
    try {
      // Add message to Firebase
      const messagesRef = ref(rtdb, `messages/${selectedChat.id}`);
      const newMessage = {
        sender: currentUser.uid,
        senderName: currentUser.displayName || "User",
        // Include anonymous name in message data
        senderAnonName: anonName || "Anonymous User",
        receiver: selectedChat.otherUser.id,
        text: filteredText, // Store filtered text
        originalText: text, // Optionally store original for moderation purposes
        timestamp: rtdbTimestamp(),
        read: false
      };
      
      // Push new message
      const messageRef = push(messagesRef);
      await set(messageRef, newMessage);
      
      // Update last message in chat
      const chatRef = ref(rtdb, `privateChats/${selectedChat.id}`);
      const updates = {
        lastMessage: filteredText, // Store filtered text as last message
        updatedAt: rtdbTimestamp()
      };
      
      // Check if the other user is currently viewing this chat
      const otherUserRef = ref(rtdb, `privateChats/${selectedChat.id}/participants/${selectedChat.otherUser.id}`);
      const otherUserSnapshot = await get(otherUserRef);
      
      if (otherUserSnapshot.exists()) {
        const otherUser = otherUserSnapshot.val();
        const lastSeen = otherUser.lastSeen;
        
        // If the other user has not seen the chat recently (in the last minute)
        // or lastSeen doesn't exist, mark as unread
        const now = new Date().getTime();
        const lastSeenTime = lastSeen ? new Date(lastSeen).getTime() : 0;
        const isRecent = (now - lastSeenTime) < 60000; // 1 minute
        
        if (!isRecent) {
          // Set unread flag for the other user
          const unreadRef = ref(rtdb, `unreadPrivateMessages/${selectedChat.otherUser.id}/${currentUser.uid}`);
          set(unreadRef, true);
          
          // Increment unread count for the other user
          updates[`unreadCount/${selectedChat.otherUser.id}`] = 1;
        }
      }
      
      await update(chatRef, updates);
      
      // Clear input
      setMessageInput('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Updated function to properly remove a chat
  const handleRemoveChat = async (e, chatId, otherUserId) => {
    e.stopPropagation(); // Prevent chat selection when clicking the remove button
    
    if (!currentUser || !chatId) return;
    
    try {
      // We set the hidden flag for the current user and clear messages
      const currentUserRef = ref(rtdb, `privateChats/${chatId}/participants/${currentUser.uid}`);
      await update(currentUserRef, {
        hidden: true
      });
      
      // Also clear any messages in the realtime database 
      // to prevent them from reappearing if chat is restored
      const messagesRef = ref(rtdb, `messages/${chatId}`);
      await remove(messagesRef);
      
      // Clear unread messages for current user
      const unreadRef = ref(rtdb, `unreadPrivateMessages/${currentUser.uid}/${otherUserId}`);
      await remove(unreadRef);
      
      // Update local state
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
      
      // If this was the selected chat, clear it
      if (selectedChat && selectedChat.id === chatId) {
        setSelectedChat(null);
      }
    } catch (error) {
      console.error("Error removing chat:", error);
    }
  };

  // Function to toggle block/unblock a user
  const handleToggleBlock = async () => {
    if (!currentUser || !selectedChat) return;
    
    try {
      // Get the current block status
      const isBlocked = selectedChat.isBlocked;
      
      // Reference to the blocked users list
      const blockRef = ref(rtdb, `privateChats/${selectedChat.id}/participants/${currentUser.uid}/blockedUsers/${selectedChat.otherUser.id}`);
      
      if (isBlocked) {
        // Unblock: Remove from blocked list
        await remove(blockRef);
      } else {
        // Block: Add to blocked list
        await set(blockRef, true);
      }
      
      // Update local state with new block status
      setSelectedChat(prev => ({
        ...prev,
        isBlocked: !isBlocked
      }));
      
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === selectedChat.id 
            ? { ...chat, isBlocked: !isBlocked } 
            : chat
        )
      );
      
      setShowBlockConfirm(false);
    } catch (error) {
      console.error("Error toggling block status:", error);
    }
  };

  // Format timestamp for chat list
  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "Never";
    
    const date = new Date(timestamp);
    const now = new Date();
    
    // If today, show time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If this year, show month and day
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    // Otherwise show date
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Generate avatar color based on userId
  const getAvatarColor = (userId) => {
    if (!userId) return 'avatar-default';
    
    const colors = [
      'avatar-red', 'avatar-pink', 'avatar-purple', 
      'avatar-indigo', 'avatar-blue', 'avatar-teal',
      'avatar-green', 'avatar-lime', 'avatar-yellow', 'avatar-orange'
    ];
    
    const charSum = userId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charSum % colors.length];
  };

  // Handle key press for message input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.loadingContainer}>
          <LoadingSpinner />
          <p>Loading conversations...</p>
        </div>
      </div>
    );
  }

  // Empty state - no conversations
  const renderEmptyState = () => (
    <div className={styles.emptyState}>
      <h3>No conversations yet</h3>
      <p>Start chatting with users from the global chat to see them here.</p>
    </div>
  );

  // For mobile view, update chat list rendering
  const renderMobileView = () => {
    if (selectedChat) {
      const otherUserAnonName = userAnonNames[selectedChat.otherUser.id] || selectedChat.otherUser.displayName;
      const isBlocked = selectedChat.isBlocked;
      const isBlockingMe = selectedChat.isBlockingMe;
      
      return (
        <div className={styles.chatContainer}>
          <div className={styles.chatHeader}>
            <button className={styles.backButton} onClick={handleBackToList}>
              ←
            </button>
            <div className={styles.chatHeaderUser}>
              <div className={`${styles.userAvatar} ${styles[getAvatarColor(selectedChat.otherUser.id)]}`}>
                {otherUserAnonName.charAt(0).toUpperCase()}
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{otherUserAnonName}</span>
                <span className={styles.userStatus}>
                  {selectedChat.otherUser.lastSeen ? 'Last seen: ' + formatLastSeen(selectedChat.otherUser.lastSeen) : 'Offline'}
                </span>
              </div>
            </div>
            <button 
              className={`${styles.blockUserButton} ${isBlocked ? styles.unblockUserButton : ''}`}
              onClick={() => setShowBlockConfirm(true)}
              title={isBlocked ? "Unblock user" : "Block user"}
            >
              {isBlocked ? "Unblock" : "Block"}
            </button>
          </div>
          <div className={`${styles.messagesContainer} ${(isBlocked || isBlockingMe) ? styles.blockedChat : ''}`}>
            {isBlocked && (
              <div className={styles.blockedMessage}>
                <p>You have blocked this user</p>
                <p className={styles.blockedSubtext}>Unblock to resume conversation</p>
              </div>
            )}
            {isBlockingMe && !isBlocked && (
              <div className={styles.blockedMessage}>
                <p>You have been blocked by this user</p>
                <p className={styles.blockedSubtext}>You cannot send messages to this user</p>
              </div>
            )}
            {!isBlocked && !isBlockingMe && messages.length === 0 && (
              <div className={styles.noMessagesYet}>
                <p>No messages yet</p>
                <p className={styles.noMessagesSubtext}>Send a message to start the conversation</p>
              </div>
            )}
            {messages.length > 0 && (
              messages.map(message => (
                <div 
                  key={message.id} 
                  className={`${styles.message} ${message.sender === currentUser.uid ? styles.sentMessage : styles.receivedMessage}`}
                >
                  <div className={styles.messageContent}>
                    {message.text}
                  </div>
                  <div className={styles.messageTime}>
                    {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className={styles.messageInputContainer}>
            {filterWarning && (
              <div className={styles.filterWarning}>
                Your message contained sensitive content and was filtered.
              </div>
            )}
            <input
              ref={messageInputRef}
              type="text"
              className={styles.messageInput}
              placeholder={isBlocked || isBlockingMe ? "Messaging unavailable" : "Type a message..."}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isBlocked || isBlockingMe}
            />
            <button 
              className={`${styles.sendButton} ${(isBlocked || isBlockingMe) ? styles.disabledButton : ''}`}
              onClick={handleSendMessage}
              disabled={isBlocked || isBlockingMe}
            >
              Send
            </button>
          </div>
          {showBlockConfirm && renderBlockConfirmation()}
        </div>
      );
    } else {
      return (
        <div className={styles.userListContainer}>
          <h2 className={styles.listHeader}>Private Chats</h2>
          <div className={styles.userList}>
            {chats.length > 0 ? (
              chats.map(chat => {
                const otherUserAnonName = userAnonNames[chat.otherUser.id] || chat.otherUser.displayName;
                const isBlocked = chat.isBlocked;
                const isBlockingMe = chat.isBlockingMe;
                
                return (
                  <div 
                    key={chat.id}
                    className={`${styles.chatItem} ${isBlocked || isBlockingMe ? styles.blockedChatItem : ''}`}
                    onClick={() => handleUserSelect(chat)}
                  >
                    <div className={`${styles.chatAvatar} ${styles[getAvatarColor(chat.otherUser.id)]}`}>
                      {otherUserAnonName.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.chatInfo}>
                      <div className={styles.chatHeader}>
                        <span className={styles.chatName}>{otherUserAnonName}</span>
                        {isBlocked && <span className={styles.blockedBadge}>Blocked</span>}
                        {isBlockingMe && !isBlocked && <span className={styles.blockedByBadge}>Blocked You</span>}
                        <span className={styles.chatTime}>
                          {chat.updatedAt ? formatLastSeen(chat.updatedAt) : ''}
                        </span>
                      </div>
                      <div className={styles.chatPreview}>
                        <span className={styles.lastMessage}>{chat.lastMessage || 'Start chatting'}</span>
                        {chat.unreadCount > 0 && !isBlocked && !isBlockingMe && (
                          <span className={styles.unreadBadge}>{chat.unreadCount}</span>
                        )}
                      </div>
                    </div>
                    <button 
                      className={styles.removeButton} 
                      onClick={(e) => handleRemoveChat(e, chat.id, chat.otherUser.id)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            ) : renderEmptyState()}
          </div>
        </div>
      );
    }
  };

  // For desktop view, update chat list and messages rendering
  const renderDesktopView = () => {
    return (
      <div className={styles.desktopLayout}>
        <div className={styles.userListContainer}>
          <h2 className={styles.listHeader}>Private Chats</h2>
          <div className={styles.userList}>
            {chats.length > 0 ? (
              chats.map(chat => {
                const otherUserAnonName = userAnonNames[chat.otherUser.id] || chat.otherUser.displayName;
                const isBlocked = chat.isBlocked;
                const isBlockingMe = chat.isBlockingMe;
                
                return (
                  <div 
                    key={chat.id}
                    className={`${styles.chatItem} ${selectedChat && selectedChat.id === chat.id ? styles.activeChatItem : ''} ${isBlocked || isBlockingMe ? styles.blockedChatItem : ''}`}
                    onClick={() => handleUserSelect(chat)}
                  >
                    <div className={`${styles.chatAvatar} ${styles[getAvatarColor(chat.otherUser.id)]}`}>
                      {otherUserAnonName.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.chatInfo}>
                      <div className={styles.chatInfoHeader}>
                        <span className={styles.chatName}>{otherUserAnonName}</span>
                        {isBlocked && <span className={styles.blockedBadge}>Blocked</span>}
                        {isBlockingMe && !isBlocked && <span className={styles.blockedByBadge}>Blocked You</span>}
                        <span className={styles.chatTime}>
                          {chat.updatedAt ? formatLastSeen(chat.updatedAt) : ''}
                        </span>
                      </div>
                      <div className={styles.chatPreview}>
                        <span className={styles.lastMessage}>{chat.lastMessage || 'Start chatting'}</span>
                        {chat.unreadCount > 0 && !isBlocked && !isBlockingMe && (
                          <span className={styles.unreadBadge}>{chat.unreadCount}</span>
                        )}
                      </div>
                    </div>
                    <button 
                      className={styles.removeButton} 
                      onClick={(e) => handleRemoveChat(e, chat.id, chat.otherUser.id)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            ) : renderEmptyState()}
          </div>
        </div>
        
        <div className={styles.chatAreaContainer}>
          {selectedChat ? (
            <>
              <div className={styles.chatHeader}>
                <div className={styles.chatHeaderUser}>
                  <div className={`${styles.userAvatar} ${styles[getAvatarColor(selectedChat.otherUser.id)]}`}>
                    {(userAnonNames[selectedChat.otherUser.id] || selectedChat.otherUser.displayName).charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{userAnonNames[selectedChat.otherUser.id] || selectedChat.otherUser.displayName}</span>
                    <span className={styles.userStatus}>
                      {selectedChat.otherUser.lastSeen ? 'Last seen: ' + formatLastSeen(selectedChat.otherUser.lastSeen) : 'Offline'}
                    </span>
                  </div>
                </div>
                <button 
                  className={`${styles.blockUserButton} ${selectedChat.isBlocked ? styles.unblockUserButton : ''}`}
                  onClick={() => setShowBlockConfirm(true)}
                  title={selectedChat.isBlocked ? "Unblock user" : "Block user"}
                >
                  {selectedChat.isBlocked ? "Unblock" : "Block"}
                </button>
              </div>
              <div className={`${styles.messagesContainer} ${(selectedChat.isBlocked || selectedChat.isBlockingMe) ? styles.blockedChat : ''}`}>
                {selectedChat.isBlocked && (
                  <div className={styles.blockedMessage}>
                    <p>You have blocked this user</p>
                    <p className={styles.blockedSubtext}>Unblock to resume conversation</p>
                  </div>
                )}
                {selectedChat.isBlockingMe && !selectedChat.isBlocked && (
                  <div className={styles.blockedMessage}>
                    <p>You have been blocked by this user</p>
                    <p className={styles.blockedSubtext}>You cannot send messages to this user</p>
                  </div>
                )}
                {!selectedChat.isBlocked && !selectedChat.isBlockingMe && messages.length === 0 && (
                  <div className={styles.noMessagesYet}>
                    <p>No messages yet</p>
                    <p className={styles.noMessagesSubtext}>Send a message to start the conversation</p>
                  </div>
                )}
                {messages.length > 0 && (
                  messages.map(message => (
                    <div 
                      key={message.id} 
                      className={`${styles.message} ${message.sender === currentUser.uid ? styles.sentMessage : styles.receivedMessage}`}
                    >
                      <div className={styles.messageContent}>
                        {message.text}
                      </div>
                      <div className={styles.messageTime}>
                        {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className={styles.messageInputContainer}>
                {filterWarning && (
                  <div className={styles.filterWarning}>
                    Your message contained sensitive content and was filtered.
                  </div>
                )}
                <input
                  ref={messageInputRef}
                  type="text"
                  className={styles.messageInput}
                  placeholder={selectedChat.isBlocked || selectedChat.isBlockingMe ? "Messaging unavailable" : "Type a message..."}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={selectedChat.isBlocked || selectedChat.isBlockingMe}
                />
                <button 
                  className={`${styles.sendButton} ${(selectedChat.isBlocked || selectedChat.isBlockingMe) ? styles.disabledButton : ''}`}
                  onClick={handleSendMessage}
                  disabled={selectedChat.isBlocked || selectedChat.isBlockingMe}
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className={styles.noChatSelected}>
              <p>Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render block confirmation dialog
  const renderBlockConfirmation = () => (
    <div className={styles.blockConfirmModal}>
      <div className={styles.blockConfirmContent}>
        <h3>{selectedChat.isBlocked ? "Unblock User?" : "Block User?"}</h3>
        <p>
          {selectedChat.isBlocked 
            ? `You will be able to send messages to ${userAnonNames[selectedChat.otherUser.id] || selectedChat.otherUser.displayName} again.` 
            : `You won't receive messages from ${userAnonNames[selectedChat.otherUser.id] || selectedChat.otherUser.displayName} anymore.`}
        </p>
        <div className={styles.blockConfirmButtons}>
          <button className={styles.cancelButton} onClick={() => setShowBlockConfirm(false)}>Cancel</button>
          <button 
            className={`${styles.confirmButton} ${selectedChat.isBlocked ? styles.unblockConfirmButton : styles.blockConfirmButton}`} 
            onClick={handleToggleBlock}
          >
            {selectedChat.isBlocked ? "Unblock" : "Block"}
          </button>
        </div>
      </div>
    </div>
  );

  // Render the main component
  return (
    <div className={styles.container}>
      <Navbar />
      {isMobile ? renderMobileView() : renderDesktopView()}
      {showBlockConfirm && renderBlockConfirmation()}
    </div>
  );
};

export default PrivateChat;