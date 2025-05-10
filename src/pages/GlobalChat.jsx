import React, { useState, useEffect, useRef } from 'react';
import styles from './GlobalChat.module.css';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { rtdb } from '../firebase/config';
import { ref, push, onValue, set, query, orderByChild, get } from 'firebase/database';
import { useContext } from 'react';
import { OnlineUsersContext } from '../App';
import MessageBubble from '../components/MessageBubble';
import { filterSensitiveContent } from '../utils/filterUtils';
import { enforceMessageLimit, MESSAGE_LIMIT } from '../utils/messageLimitUtils';

const GlobalChat = () => {
  const { currentUser, anonName } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [userId, setUserId] = useState('');
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState([]);
  const [newOption, setNewOption] = useState('');
  const onlineUsers = useContext(OnlineUsersContext);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const newOptionInputRef = useRef(null);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef(null);
  const mentionsBoxRef = useRef(null);

  useEffect(() => {
    // Set user ID and username
    if (currentUser) {
      setUserId(currentUser.uid);
    } else {
      // Fallback for users not authenticated
      const storedUser = localStorage.getItem('userID');
      if (storedUser) {
        setUserId(storedUser);
      } else {
        // Generate random user ID like userXyz, userAbc, etc.
        const randomChar = () => String.fromCharCode(97 + Math.floor(Math.random() * 26));
        const newUserId = `user${randomChar()}${randomChar()}${Math.floor(Math.random() * 10)}`;
        setUserId(newUserId);
        localStorage.setItem('userID', newUserId);
      }
    }

    // Listen for all messages in the global chat
    const messagesRef = ref(rtdb, 'globalMessages');
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
      } else {
        setMessages([]);
      }
    });

    // Initial check of message count
    const checkMessageCount = async () => {
      const messagesRef = ref(rtdb, 'globalMessages');
      const snapshot = await get(messagesRef);
      
      if (snapshot.exists()) {
        const messagesCount = Object.keys(snapshot.val()).length;
        if (messagesCount > MESSAGE_LIMIT) {
          console.log(`Initial message count (${messagesCount}) exceeds limit (${MESSAGE_LIMIT}), enforcing limit...`);
          await enforceMessageLimit();
        }
      }
    };
    
    checkMessageCount();

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus on the option input when poll modal opens
  useEffect(() => {
    if (showPollModal && newOptionInputRef.current) {
      // Short delay to ensure modal is rendered
      setTimeout(() => {
        newOptionInputRef.current.focus();
      }, 100);
    }
  }, [showPollModal]);

  // Handle click outside mentions dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mentionsBoxRef.current && !mentionsBoxRef.current.contains(e.target) && 
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowMentions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const openPollModal = () => {
    setPollQuestion('');
    setPollOptions([]);
    setNewOption('');
    setShowPollModal(true);
  };

  const sendMessage = async () => {
    if (input.trim()) {
      // Use anonymous name if available, otherwise fall back to display name or user ID
      const displayName = anonName || (currentUser?.displayName || userId);
      
      // Filter sensitive content before sending
      const filteredText = filterSensitiveContent(input);
      
      // Find all @mentions in the message
      const mentionRegex = /@(\w+)/g;
      const mentions = [];
      let match;
      
      while ((match = mentionRegex.exec(filteredText)) !== null) {
        mentions.push(match[1]); // Capture the username without @
      }
      
      const messageData = {
        userId: userId,
        username: displayName,
        text: filteredText,
        type: 'text',
        timestamp: new Date().toISOString(),
        mentions: mentions.length > 0 ? mentions : null
      };
      
      try {
        // Push the message to Firebase Realtime Database
        const messagesRef = ref(rtdb, 'globalMessages');
        await push(messagesRef, messageData);
        
        // Check if we need to enforce message limit client-side
        const messagesSnapshot = await get(messagesRef);
        if (messagesSnapshot.exists() && Object.keys(messagesSnapshot.val()).length > MESSAGE_LIMIT) {
          console.log("Message limit exceeded, triggering client-side enforcement");
          await enforceMessageLimit();
        }
        
        setInput('');
      } catch (error) {
        console.error("Error sending message:", error);
        alert("Failed to send message. Please try again.");
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (showMentions && mentionSuggestions.length > 0) {
        // If mention dropdown is open, Tab or Enter selects the first suggestion
        insertMention(mentionSuggestions[0].username || mentionSuggestions[0].displayName || mentionSuggestions[0].anonName || mentionSuggestions[0].uid);
        e.preventDefault();
      } else {
        sendMessage();
      }
    } else if (e.key === 'Tab' && showMentions && mentionSuggestions.length > 0) {
      // Tab also selects first suggestion
      insertMention(mentionSuggestions[0].username || mentionSuggestions[0].displayName || mentionSuggestions[0].anonName || mentionSuggestions[0].uid);
      e.preventDefault();
    } else if (e.key === 'Escape' && showMentions) {
      // Escape closes the mention suggestions
      setShowMentions(false);
      e.preventDefault();
    } else if (e.key === 'ArrowDown' && showMentions && mentionSuggestions.length > 0) {
      // Navigate through suggestions with arrow keys
      insertMention(mentionSuggestions[0].username || mentionSuggestions[0].displayName || mentionSuggestions[0].anonName || mentionSuggestions[0].uid);
      e.preventDefault();
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInput(newValue);
    
    // Check for "@" character to trigger mentions
    if (inputRef.current) {
      const curPos = inputRef.current.selectionStart;
      setCursorPosition(curPos);
      
      // Find the @ symbol before the cursor
      const textBeforeCursor = newValue.substring(0, curPos);
      const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
      
      if (mentionMatch) {
        const query = mentionMatch[1].toLowerCase();
        setMentionQuery(query);
        
        // Filter online users based on the query
        if (onlineUsers && onlineUsers.length > 0) {
          const filteredUsers = onlineUsers
            .filter(user => {
              // Get display name for comparison
              const userDisplayName = user.anonName || user.displayName || user.uid || '';
              return userDisplayName.toLowerCase().includes(query);
            })
            .slice(0, 5); // Limit to 5 suggestions
          
          setMentionSuggestions(filteredUsers);
          setShowMentions(filteredUsers.length > 0);
        } else {
          setShowMentions(false);
        }
      } else {
        setShowMentions(false);
      }
    }
  };

  const insertMention = (username) => {
    if (!inputRef.current || !username) return;
    
    const curPos = cursorPosition;
    const textBeforeCursor = input.substring(0, curPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const startPos = curPos - mentionMatch[0].length;
      const newText = input.substring(0, startPos) + 
                    `@${username} ` + 
                    input.substring(curPos);
      
      setInput(newText);
      
      // Focus and set cursor position after the inserted mention
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newPosition = startPos + username.length + 2; // +2 for @ and space
          inputRef.current.setSelectionRange(newPosition, newPosition);
          setCursorPosition(newPosition);
        }
      }, 0);
    }
    
    setShowMentions(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (['image/jpeg', 'image/png'].includes(file.type)) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            // Use anonymous name if available, otherwise fall back to display name or user ID
            const displayName = anonName || (currentUser?.displayName || userId);
            
            const imageData = {
              userId: userId,
              username: displayName,
              type: 'image',
              imageUrl: event.target.result,
              timestamp: new Date().toISOString()
            };
            
            // Push the image to Firebase Realtime Database
            const messagesRef = ref(rtdb, 'globalMessages');
            await push(messagesRef, imageData);
            
            // Check if we need to enforce message limit client-side
            const messagesSnapshot = await get(messagesRef);
            if (messagesSnapshot.exists() && Object.keys(messagesSnapshot.val()).length > MESSAGE_LIMIT) {
              await enforceMessageLimit();
            }
          } catch (error) {
            console.error("Error uploading image:", error);
            alert("Failed to upload image. Please try again.");
          }
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please upload only JPG, JPEG or PNG images.');
      }
    }
    // Reset file input
    e.target.value = '';
  };

  const openFileSelector = () => {
    fileInputRef.current.click();
  };

  const handleAddOption = () => {
    if (newOption.trim() && !pollOptions.includes(newOption.trim())) {
      // Filter sensitive content in poll options
      const filteredOption = filterSensitiveContent(newOption.trim());
      setPollOptions([...pollOptions, filteredOption]);
      setNewOption('');
      
      // Focus back on the input after adding
      if (newOptionInputRef.current) {
        newOptionInputRef.current.focus();
      }
    }
  };

  const handleRemoveOption = (indexToRemove) => {
    setPollOptions(pollOptions.filter((_, index) => index !== indexToRemove));
  };

  const handleOptionKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOption();
    }
  };

  const createPoll = async () => {
    if (pollQuestion.trim() === '') {
      alert('Please enter a poll question');
      return;
    }

    if (pollOptions.length < 2) {
      alert('Please add at least two options for the poll');
      return;
    }
    
    try {
      // Use anonymous name if available, otherwise fall back to display name or user ID
      const displayName = anonName || (currentUser?.displayName || userId);
      
      // Filter sensitive content in poll question
      const filteredQuestion = filterSensitiveContent(pollQuestion.trim());
      
      // Create an options object with each option initialized to 0 votes
      const optionsObj = {};
      pollOptions.forEach(option => {
        optionsObj[option] = 0;
      });
      
      const pollData = {
        userId: userId,
        username: displayName,
        type: 'poll',
        question: filteredQuestion,
        options: optionsObj,
        timestamp: new Date().toISOString(),
        voters: {}
      };
      
      // Push the poll to Firebase Realtime Database
      const messagesRef = ref(rtdb, 'globalMessages');
      await push(messagesRef, pollData);
      
      // Check if we need to enforce message limit client-side
      const messagesSnapshot = await get(messagesRef);
      if (messagesSnapshot.exists() && Object.keys(messagesSnapshot.val()).length > MESSAGE_LIMIT) {
        await enforceMessageLimit();
      }
      
      // Reset form and close modal
      setPollQuestion('');
      setPollOptions([]);
      setShowPollModal(false);
    } catch (error) {
      console.error("Error creating poll:", error);
      alert("Failed to create poll. Please try again.");
    }
  };

  const votePoll = (messageId, option) => {
    const message = messages.find(msg => msg.id === messageId);
    if (!message) return;
    
    try {
      // Create a copy of the message to update
      const updatedMessage = { ...message };
      
      // Prevent double voting
      if (updatedMessage.voters && updatedMessage.voters[userId]) {
        const prevVote = updatedMessage.voters[userId];
        updatedMessage.options[prevVote]--;
      }
      
      // Add new vote
      updatedMessage.options[option]++;
      if (!updatedMessage.voters) updatedMessage.voters = {};
      updatedMessage.voters[userId] = option;
      
      // Update the poll in Firebase Realtime Database
      const pollRef = ref(rtdb, `globalMessages/${messageId}`);
      set(pollRef, updatedMessage);
    } catch (error) {
      console.error("Error voting in poll:", error);
      alert("Failed to register your vote. Please try again.");
    }
  };

  return (
    <div className={styles.chatPage}>
      <Navbar />

      <div className={styles.chatContainer}>
        <div className={styles.messagesContainer}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={{...message, onVote: message.type === 'poll' ? votePoll : undefined}}
              isOwn={message.userId === userId}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.inputContainer}>
          <div className={styles.inputContainerWrapper}>
            <div className={styles.inputWrapper}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                placeholder="Type a message... (Use @ to mention)"
                className={styles.messageInput}
              />
              <div className={styles.actionButtons}>
                <button className={styles.sendButton} onClick={sendMessage}>
                  <span className={styles.sendIcon}>➤</span>
                </button>
                <button className={styles.uploadButton} onClick={openFileSelector}>
                  <span className={styles.uploadIcon}>+</span>
                </button>
                <input 
                  ref={fileInputRef} 
                  type="file"
                  accept=".jpg,.jpeg,.png" 
                  style={{ display: 'none' }} 
                  onChange={handleImageUpload}
                />
                <button className={styles.pollButton} onClick={openPollModal}>
                  <span className={styles.pollIcon}>📊</span>
                </button>
              </div>
            </div>
            
            {/* Mention suggestions dropdown */}
            {showMentions && mentionSuggestions.length > 0 && (
              <div ref={mentionsBoxRef} className={styles.mentionsDropdown}>
                {mentionSuggestions.map((user, index) => {
                  const displayName = user.anonName || user.displayName || user.uid || '';
                  return (
                    <div 
                      key={user.uid || index}
                      className={styles.mentionItem}
                      onClick={() => insertMention(displayName)}
                    >
                      <div className={styles.mentionAvatar}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <span>{displayName}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPollModal && (
        <div className={styles.pollModalOverlay} onClick={() => setShowPollModal(false)}>
          <div className={styles.pollModal} onClick={(e) => e.stopPropagation()}>
            <h3>Create Poll</h3>
            <div className={styles.pollFormGroup}>
              <label>Poll Question</label>
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Enter your question..."
                className={styles.pollQuestionInput}
              />
            </div>
            
            <div className={styles.pollFormGroup}>
              <label>Poll Options {pollOptions.length > 0 ? `(${pollOptions.length})` : ''}</label>
              
              {pollOptions.length > 0 ? (
                <div className={styles.pollOptionsList}>
                  {pollOptions.map((option, index) => (
                    <div key={index} className={styles.pollOptionItem}>
                      <span>{option}</span>
                      <button 
                        onClick={() => handleRemoveOption(index)}
                        className={styles.removeOptionBtn}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyOptionsMessage}>
                  Add at least two options for your poll
                </div>
              )}
              
              <div className={styles.addOptionContainer}>
                <input
                  type="text"
                  ref={newOptionInputRef}
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyPress={handleOptionKeyPress}
                  placeholder="Add a new option..."
                  className={styles.newOptionInput}
                />
                <button 
                  onClick={handleAddOption}
                  className={styles.addOptionBtn}
                  disabled={!newOption.trim() || pollOptions.includes(newOption.trim())}
                >
                  Add
                </button>
              </div>
            </div>
            
            <div className={styles.pollModalActions}>
              <button 
                onClick={() => setShowPollModal(false)} 
                className={styles.cancelBtn}
              >
                Cancel
              </button>
              <button 
                onClick={createPoll} 
                className={styles.createBtn}
                disabled={!pollQuestion.trim() || pollOptions.length < 2}
              >
                Create Poll
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalChat;