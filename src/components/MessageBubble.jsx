// MessageBubble.jsx
import React, { useState, useRef, useEffect } from 'react';
import styles from './MessageBubble.module.css';
import { useAuth } from '../context/AuthContext';
import { db, rtdb } from '../firebase/config';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, push, set, serverTimestamp as rtdbTimestamp } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import useAnonName from '../hooks/useAnonName';
import UserAvatar from './UserAvatar';

const MessageBubble = ({ message, isOwn, isCurrentUser, showAvatar = true, avatarColor }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Get the anonymous name for this message sender
  const { anonName, loading } = useAnonName(message.userId || message.sender);

  // Format timestamp to display time only
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Toggle dropdown menu
  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  // Handle add to private chat
  const handleAddToPrivateChat = async () => {
    if (!currentUser || !message.userId || currentUser.uid === message.userId) {
      setShowDropdown(false);
      return;
    }

    try {
      // Create a conversation ID (sorted to ensure consistency)
      const getConversationId = (uid1, uid2) => {
        return [uid1, uid2].sort().join('_');
      };
      
      const conversationId = getConversationId(currentUser.uid, message.userId);
      
      // Create or update the private chat entry in Firebase Realtime Database
      const privateChatRef = ref(rtdb, `privateChats/${conversationId}`);
      
      await set(privateChatRef, {
        createdAt: rtdbTimestamp(),
        updatedAt: rtdbTimestamp(),
        participants: {
          [currentUser.uid]: {
            id: currentUser.uid,
            displayName: currentUser.displayName || "User",
            lastSeen: rtdbTimestamp()
          },
          [message.userId]: {
            id: message.userId,
            displayName: message.username || "User",
            lastSeen: null
          }
        }
      });
      
      // Add welcome message to private messages
      const messagesRef = ref(rtdb, `messages/${conversationId}`);
      await push(messagesRef, {
        sender: currentUser.uid,
        senderName: currentUser.displayName || "User",
        receiver: message.userId,
        text: "Hi! I added you from the global chat.",
        timestamp: rtdbTimestamp(),
        read: false
      });
      
      // Close dropdown
      setShowDropdown(false);
      
      // Also store in Firestore for persistence (if needed)
      try {
        const conversationsRef = collection(db, "conversations");
        const q = query(conversationsRef, where("id", "==", conversationId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          await addDoc(conversationsRef, {
            id: conversationId,
            participants: [currentUser.uid, message.userId],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error("Error saving to Firestore:", error);
      }
      
      // Navigate to private chat
      navigate('/private-chat');
      
    } catch (error) {
      console.error("Error adding to private chat:", error);
    }
  };

  // Determine if we're handling a global message or private message
  const isGlobalMessage = message.hasOwnProperty('userId');
  const userId = isGlobalMessage ? message.userId : message.sender;
  
  // Use anonymous name if available, otherwise fallback to username/displayName
  const displayName = anonName || (isGlobalMessage ? message.username : message.senderName) || userId || 'Anonymous';
  
  const text = message.text;

  // Get gender-based avatar color - This determines the color based on message gender
  const getGenderColor = () => {
    // Check if explicit avatarColor was provided
    if (avatarColor) return avatarColor;
    
    // Check if gender is available in message or userData
    const gender = message.gender || (message.userData && message.userData.gender);
    
    // Return blue for male, pink for female, default color if gender not specified
    if (gender === 'male') return 'blue';
    if (gender === 'female') return 'pink';
    return message.avatarColor || 'purple'; // Default now purple for better visual distinction
  };

  // Determine which UI style to use based on props
  const usingNewUI = isCurrentUser !== undefined;
  
  // If using the new UI structure with isCurrentUser prop (modern bubbles)
  if (usingNewUI) {
    const formattedTime = formatTime(message.timestamp);
    
    return (
      <div 
        className={`${styles.messageBubbleContainer} ${
          isCurrentUser ? styles.currentUser : styles.otherUser
        }`}
      >
        {showAvatar && !isCurrentUser && (
          <div className={styles.avatarWrapper}>
            <UserAvatar 
              avatarColor={getGenderColor()}
              size="sm"
            />
          </div>
        )}
        
        <div className={styles.messageContentWrapper}>
          {!isCurrentUser && (
            <div className={styles.senderName}>{displayName}</div>
          )}
          
          <div 
            className={`${styles.messageBubble} ${
              isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
            }`}
          >
            {message.type === 'image' ? (
              <div className={styles.imageContainer}>
                <img src={message.imageUrl} alt="User uploaded" className={styles.messageImage} />
              </div>
            ) : message.type === 'poll' ? (
              <div className={styles.pollContainer}>
                <div className={styles.pollQuestion}>{message.question}</div>
                <div className={styles.pollOptions}>
                  {Object.entries(message.options || {}).map(([option, votes], idx) => {
                    // Calculate percentage for progress bar
                    const totalVotes = Object.values(message.options).reduce((sum, count) => sum + count, 0);
                    const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                    
                    // Check if current user voted for this option
                    const isVotedByUser = message.voters && message.voters[userId] === option;
                    
                    return (
                      <div key={option} className={`${styles.pollOption} ${isVotedByUser ? styles.votedOption : ''}`}>
                        <button 
                          className={styles.pollVoteButton}
                          onClick={() => message.onVote && message.onVote(message.id, option)}
                        >
                          <div className={styles.pollOptionContent}>
                            <span className={styles.pollOptionText}>
                              {option}
                            </span>
                            <span className={styles.pollOptionVotes}>
                              {votes} {votes === 1 ? 'vote' : 'votes'}
                            </span>
                          </div>
                          <div className={styles.pollProgressContainer}>
                            <div 
                              className={styles.pollProgressBar} 
                              style={{ width: `${percentage}%` }}
                            ></div>
                            <span className={styles.pollPercentage}>{percentage}%</span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className={styles.messageText}>{text}</p>
            )}
            <span className={styles.messageTime}>{formattedTime}</span>
          </div>
        </div>
        
        {!isCurrentUser && (
          <div className={styles.messageActions}>
            <button 
              className={styles.actionButton} 
              onClick={toggleDropdown}
              aria-label="More options"
            >
              <span className={styles.actionDots}>⋯</span>
            </button>
            {showDropdown && (
              <div ref={dropdownRef} className={styles.dropdown}>
                <button 
                  onClick={handleAddToPrivateChat} 
                  className={styles.dropdownItem}
                  disabled={isOwn || !currentUser}
                >
                  Start private chat
                </button>
              </div>
            )}
          </div>
        )}
        
        {showAvatar && isCurrentUser && (
          <div className={styles.avatarPlaceholder}></div>
        )}
      </div>
    );
  }
  
  // Otherwise, use the improved standard UI structure
  return (
    <div className={`${styles.messageBubbleContainer} ${isOwn ? styles.ownMessage : ''}`}>
      <div className={styles.avatar}>
        <div 
          className={`${styles.avatarImage} ${
            getGenderColor() === 'blue' 
              ? styles.maleBackground 
              : getGenderColor() === 'pink' 
                ? styles.femaleBackground 
                : styles.defaultBackground
          }`}
        >
          {displayName && displayName.charAt(0).toUpperCase()}
        </div>
      </div>
      <div className={styles.messageContent}>
        <div className={styles.header}>
          <span className={styles.username}>{displayName}</span>
          <div className={styles.actionsContainer}>
            <span className={styles.timestamp}>{formatTime(message.timestamp)}</span>
            {!isOwn && (
              <button className={styles.optionsButton} onClick={toggleDropdown} aria-label="Options">⋮</button>
            )}
            {showDropdown && (
              <div ref={dropdownRef} className={styles.dropdown}>
                <button 
                  onClick={handleAddToPrivateChat} 
                  className={styles.dropdownItem}
                  disabled={isOwn || !currentUser}
                >
                  Start private chat
                </button>
              </div>
            )}
          </div>
        </div>
        
        {message.type === 'image' ? (
          <div className={styles.imageContainer}>
            <img src={message.imageUrl} alt="User uploaded" className={styles.messageImage} />
          </div>
        ) : message.type === 'poll' ? (
          <div className={styles.pollContainer}>
            <div className={styles.pollQuestion}>{message.question}</div>
            <div className={styles.pollOptions}>
              {Object.entries(message.options || {}).map(([option, votes], idx) => {
                // Calculate percentage for progress bar
                const totalVotes = Object.values(message.options).reduce((sum, count) => sum + count, 0);
                const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                
                // Check if current user voted for this option
                const isVotedByUser = message.voters && message.voters[userId] === option;
                
                return (
                  <div key={option} className={`${styles.pollOption} ${isVotedByUser ? styles.votedOption : ''}`}>
                    <button 
                      className={styles.pollVoteButton}
                      onClick={() => message.onVote && message.onVote(message.id, option)}
                    >
                      <div className={styles.pollOptionContent}>
                        <span className={styles.pollOptionText}>
                          {option}
                        </span>
                        <span className={styles.pollOptionVotes}>
                          {votes} {votes === 1 ? 'vote' : 'votes'}
                        </span>
                      </div>
                      <div className={styles.pollProgressContainer}>
                        <div 
                          className={styles.pollProgressBar} 
                          style={{ width: `${percentage}%` }}
                        ></div>
                        <span className={styles.pollPercentage}>{percentage}%</span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <span className={styles.messageText}>{text}</span>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;