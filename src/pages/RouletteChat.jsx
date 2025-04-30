import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rtdb } from '../firebase/config';
import { ref, set, onValue, push, remove, onDisconnect, get, update, serverTimestamp } from 'firebase/database';
import styles from './RouletteChat.module.css';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import { getDisplayName } from '../hooks/useAnonName';
import { filterSensitiveContent, containsSensitiveContent } from '../utils/filterUtils';

// Custom message bubble component specifically for roulette chat
const RouletteChatBubble = ({ text, isOwn, timestamp }) => {
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Apply filter to the message text
  const filteredText = filterSensitiveContent(text);

  return (
    <div className={`${styles.messageBubble} ${isOwn ? styles.ownMessage : styles.partnerMessage}`}>
      <div className={styles.messageContent}>
        <p className={styles.messageText}>{filteredText}</p>
        <span className={styles.messageTime}>{formatTime(timestamp)}</span>
      </div>
    </div>
  );
};

const RouletteChat = () => {
  const navigate = useNavigate();
  const { currentUser, anonName } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [partnerId, setPartnerId] = useState(null);
  const [partnerName, setPartnerName] = useState(null);
  const [partnerAnonName, setPartnerAnonName] = useState(null);
  const [isSearching, setIsSearching] = useState(true);
  const [partnerDisconnected, setPartnerDisconnected] = useState(false);
  const [pairId, setPairId] = useState(null);
  const [usersInQueue, setUsersInQueue] = useState(0);
  const [isSkipping, setIsSkipping] = useState(false);
  const [hasFilterWarning, setHasFilterWarning] = useState(false);
  
  // References
  const messageContainerRef = useRef(null);
  const presenceRef = useRef(null);
  const userPairRef = useRef(null);
  const messagesRef = useRef(null);
  const queueRef = useRef(null);
  const initialized = useRef(false);
  const pairingInProgress = useRef(false);

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
  }, [currentUser, navigate]);

  // Common cleanup function
  const cleanupUser = async () => {
    try {
      // Remove from queue if present
      if (currentUser) {
        await remove(ref(rtdb, `/rouletteQueue/${currentUser.uid}`));
      }
      
      // Remove pair information
      if (partnerId) {
        // Notify partner by setting a disconnected flag
        await update(ref(rtdb, `/roulettePairs/${partnerId}`), {
          partnerDisconnected: true
        });
        
        // Remove own pair info
        await remove(ref(rtdb, `/roulettePairs/${currentUser?.uid}`));
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  };

  // Initialize presence tracking
  useEffect(() => {
    if (!currentUser || initialized.current) return;
    
    const setupPresence = async () => {
      try {
        // Set up presence reference
        presenceRef.current = ref(rtdb, `/roulettePresence/${currentUser.uid}`);
        
        // Get anonymous name from context or fetch it
        const userAnonName = anonName || await getDisplayName(currentUser.uid);
        
        // Set user as online
        await set(presenceRef.current, {
          online: true,
          displayName: currentUser.displayName || 'Anonymous',
          anonName: userAnonName,
          lastActive: serverTimestamp()
        });
        
        // Clear user data on disconnect
        onDisconnect(presenceRef.current).remove();
        
        // Also clear queue and pairing data on disconnect
        const userQueueRef = ref(rtdb, `/rouletteQueue/${currentUser.uid}`);
        onDisconnect(userQueueRef).remove();
        
        const userPairRef = ref(rtdb, `/roulettePairs/${currentUser.uid}`);
        onDisconnect(userPairRef).remove();
        
        initialized.current = true;
        
        // Start search process
        joinQueue();
      } catch (error) {
        console.error("Error setting up presence:", error);
      }
    };
    
    setupPresence();
    
    return () => {
      cleanupUser();
    };
  }, [currentUser, anonName]);

  // Track queue size
  useEffect(() => {
    if (!currentUser) return;
    
    const allQueueRef = ref(rtdb, '/rouletteQueue');
    const unsubscribe = onValue(allQueueRef, (snapshot) => {
      const queue = snapshot.val() || {};
      setUsersInQueue(Object.keys(queue).length);
    });
    
    return () => unsubscribe();
  }, [currentUser]);

  // Join the queue to find a partner
  const joinQueue = async () => {
    if (!currentUser) return;
    
    try {
      setIsSearching(true);
      setIsConnected(false);
      setPartnerDisconnected(false);
      setPartnerId(null);
      setPartnerName(null);
      setPartnerAnonName(null);
      setPairId(null);
      
      // Clear any previous pair
      await remove(ref(rtdb, `/roulettePairs/${currentUser.uid}`));
      
      // Get anonymous name
      const userAnonName = anonName || await getDisplayName(currentUser.uid);
      
      // Add user to queue with timestamp
      queueRef.current = ref(rtdb, `/rouletteQueue/${currentUser.uid}`);
      await set(queueRef.current, {
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        anonName: userAnonName,
        joinedAt: Date.now()
      });
      
      // Automatic cleanup on disconnect
      onDisconnect(queueRef.current).remove();
    } catch (error) {
      console.error("Error joining queue:", error);
    }
  };

  // Listen for pairing updates
  useEffect(() => {
    if (!currentUser) return;
    
    // Create reference to user's pair data
    userPairRef.current = ref(rtdb, `/roulettePairs/${currentUser.uid}`);
    
    // Listen for pair status changes
    const unsubscribe = onValue(userPairRef.current, (snapshot) => {
      const pairData = snapshot.val();
      
      if (pairData) {
        // User has been paired
        const partnerDisconnected = !!pairData.partnerDisconnected;
        
        if (partnerDisconnected) {
          // Partner disconnected/skipped
          setPartnerDisconnected(true);
          setIsConnected(false);
          setIsSearching(false);
        } else {
          // Active connection
          setIsSearching(false);
          setIsConnected(true);
          setPartnerDisconnected(false);
          setPartnerId(pairData.partnerId);
          setPartnerName(pairData.partnerName);
          setPartnerAnonName(pairData.partnerAnonName);
          setPairId(pairData.pairId);
          
          // If we were in the queue, remove us
          if (currentUser.uid) {
            remove(ref(rtdb, `/rouletteQueue/${currentUser.uid}`));
          }
        }
      } else if (partnerId) {
        // Our pair was removed
        setPartnerDisconnected(true);
        setIsConnected(false);
        setIsSearching(false);
      }
    });
    
    return () => unsubscribe();
  }, [currentUser, partnerId]);

  // Check if a user is currently paired
  const checkIfUserIsPaired = async (userId) => {
    try {
      const pairSnapshot = await get(ref(rtdb, `/roulettePairs/${userId}`));
      return pairSnapshot.exists();
    } catch (error) {
      console.error("Error checking if user is paired:", error);
      return false;
    }
  };
  
  // Listen to queue and perform matching
  useEffect(() => {
    if (!currentUser || !isSearching || isConnected || partnerId || pairingInProgress.current) return;
    
    const allQueueRef = ref(rtdb, '/rouletteQueue');
    
    const attemptMatch = async (queue) => {
      // If we're not actually searching or already connected, don't try to match
      if (!queue || !queue[currentUser.uid] || isConnected || partnerId || pairingInProgress.current) {
        return;
      }
      
      pairingInProgress.current = true;
      
      try {
        // Get all users except current user
        const otherUsers = Object.entries(queue)
          .filter(([key]) => key !== currentUser.uid)
          .map(([key, val]) => ({ id: key, ...val }))
          .sort((a, b) => a.joinedAt - b.joinedAt);
        
        if (otherUsers.length === 0) {
          pairingInProgress.current = false;
          return;
        }
        
        // Find first available partner that isn't already paired
        let validPartner = null;
        
        for (const potentialPartner of otherUsers) {
          // Check if this user is already paired
          const isPaired = await checkIfUserIsPaired(potentialPartner.id);
          
          if (!isPaired) {
            validPartner = potentialPartner;
            break;
          }
        }
        
        if (!validPartner) {
          pairingInProgress.current = false;
          return;
        }
        
        const partner = validPartner;
        
        // Double-check that we're still in the queue
        const selfSnapshot = await get(ref(rtdb, `/rouletteQueue/${currentUser.uid}`));
        if (!selfSnapshot.exists()) {
          pairingInProgress.current = false;
          return;
        }
        
        // Get current user's anonymous name
        const userAnonName = anonName || await getDisplayName(currentUser.uid);
        
        // Only the user with lower UID creates the pair to avoid race conditions
        if (currentUser.uid < partner.id) {
          // Create unique pair ID
          const newPairId = `${currentUser.uid}_${partner.id}_${Date.now()}`;
          
          // Remove both users from queue first
          await remove(ref(rtdb, `/rouletteQueue/${currentUser.uid}`));
          await remove(ref(rtdb, `/rouletteQueue/${partner.id}`));
          
          // Create pair entries for both users
          await set(ref(rtdb, `/roulettePairs/${currentUser.uid}`), {
            partnerId: partner.id,
            partnerName: partner.username,
            partnerAnonName: partner.anonName,
            pairId: newPairId,
            timestamp: Date.now()
          });
          
          await set(ref(rtdb, `/roulettePairs/${partner.id}`), {
            partnerId: currentUser.uid,
            partnerName: currentUser.displayName || 'Anonymous',
            partnerAnonName: userAnonName,
            pairId: newPairId,
            timestamp: Date.now()
          });
          
          // Update local state
          setIsSearching(false);
          setIsConnected(true);
          setPartnerId(partner.id);
          setPartnerName(partner.username);
          setPartnerAnonName(partner.anonName);
          setPairId(newPairId);
        }
      } catch (error) {
        console.error("Error creating pair:", error);
        // If pairing fails, make sure user is still in queue
        const userInQueue = await get(ref(rtdb, `/rouletteQueue/${currentUser.uid}`));
        if (!userInQueue.exists()) {
          joinQueue();
        }
      } finally {
        pairingInProgress.current = false;
      }
    };
    
    // Listen for queue changes
    const unsubscribe = onValue(allQueueRef, (snapshot) => {
      const queue = snapshot.val();
      
      if (isSearching && !isConnected && !partnerId && !pairingInProgress.current) {
        attemptMatch(queue);
      }
    });
    
    return () => unsubscribe();
  }, [currentUser, isSearching, isConnected, partnerId, anonName]);

  // Listen for messages when paired
  useEffect(() => {
    if (!pairId) {
      setMessages([]);
      return;
    }
    
    messagesRef.current = ref(rtdb, `/rouletteMessages/${pairId}`);
    
    const unsubscribe = onValue(messagesRef.current, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messageList = Object.entries(data).map(([key, val]) => ({
          id: key,
          ...val
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        setMessages(messageList);
      } else {
        setMessages([]);
      }
    });
    
    // Set up cleanup only on complete disconnect
    onDisconnect(messagesRef.current).remove();
    
    return () => unsubscribe();
  }, [pairId]);

  // Auto-scroll messages
  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle message input change
  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    
    // Check if message contains sensitive content
    if (containsSensitiveContent(e.target.value)) {
      setHasFilterWarning(true);
    } else {
      setHasFilterWarning(false);
    }
  };

  // Send a message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !isConnected || !pairId) return;
    
    try {
      if (!messagesRef.current) {
        messagesRef.current = ref(rtdb, `/rouletteMessages/${pairId}`);
      }
      
      const userAnonName = anonName || await getDisplayName(currentUser.uid);
      
      await push(messagesRef.current, {
        text: inputMessage.trim(),
        sender: currentUser.uid,
        senderName: userAnonName, // Use anonymous name here
        timestamp: Date.now()
      });
      
      setInputMessage('');
      setHasFilterWarning(false);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Skip current partner and find a new one
  const skipPartner = async () => {
    if (!currentUser || isSkipping) return;
    
    try {
      setIsSkipping(true);
      
      // Make sure we're not in the queue already
      await remove(ref(rtdb, `/rouletteQueue/${currentUser.uid}`));
      
      if (partnerId) {
        // Mark partner's pair data as disconnected
        await update(ref(rtdb, `/roulettePairs/${partnerId}`), {
          partnerDisconnected: true
        });
        
        // Remove own pair data
        await remove(ref(rtdb, `/roulettePairs/${currentUser.uid}`));
      }
      
      // Reset state
      setIsConnected(false);
      setPartnerId(null);
      setPartnerName(null);
      setPartnerAnonName(null);
      setPairId(null);
      setPartnerDisconnected(false);
      
      // Delay joining queue slightly to let other pairs resolve first
      setTimeout(async () => {
        await joinQueue();
        setIsSkipping(false);
      }, 500);
    } catch (error) {
      console.error("Error during skip:", error);
      setIsSkipping(false);
      // Try again if failed
      setTimeout(() => joinQueue(), 1000);
    }
  };

  // Function to find new partner when disconnected
  const findNewPartner = () => {
    skipPartner();
  };

  return (
    <div className={styles.rouletteChatContainer}>
      <Navbar />
      <div className={styles.chatPageContent}>
        <div className={styles.chatHeader}>
          <h2>Roulette Chat</h2>
          {isSearching && !partnerDisconnected && (
            <p className={styles.searchingText}>
              Looking for someone to chat with... {usersInQueue > 0 ? `(${usersInQueue} in queue)` : ''}
            </p>
          )}
          {isConnected && partnerId && (
            <p className={styles.connectedText}>
              Connected with {partnerAnonName || 'Anonymous'}
            </p>
          )}
          {partnerDisconnected && (
            <p className={styles.disconnectedText}>Stranger has disconnected</p>
          )}
          {isSkipping && (
            <p className={styles.searchingText}>Finding a new partner...</p>
          )}
        </div>

        <div className={styles.chatWindow} ref={messageContainerRef}>
          {isSearching && !partnerDisconnected && !isSkipping && (
            <div className={styles.searchingIndicator}>
              <LoadingSpinner />
              <p>Finding a chat partner...</p>
            </div>
          )}
          
          {isSkipping && (
            <div className={styles.searchingIndicator}>
              <LoadingSpinner />
              <p>Finding a new partner...</p>
            </div>
          )}

          {partnerDisconnected && !isSkipping && (
            <div className={styles.disconnectNotice}>
              <p>Your chat partner has disconnected.</p>
              <button onClick={findNewPartner} className={styles.findNewButton}>
                Find a new partner
              </button>
            </div>
          )}

          {messages.length > 0 && (
            <div className={styles.messagesContainer}>
              {messages.map((msg) => (
                <RouletteChatBubble
                  key={msg.id}
                  text={msg.text}
                  isOwn={msg.sender === currentUser?.uid}
                  timestamp={msg.timestamp}
                />
              ))}
            </div>
          )}

          {isConnected && partnerId && messages.length === 0 && (
            <div className={styles.emptyChat}>
              <p>Say hi to start the conversation!</p>
            </div>
          )}
        </div>

        <div className={styles.chatControls}>
          <form onSubmit={sendMessage} className={styles.messageForm}>
            <div className={styles.messageInputContainer}>
              <input
                type="text"
                value={inputMessage}
                onChange={handleInputChange}
                placeholder={isConnected && partnerId ? "Type a message..." : "Waiting for connection..."}
                disabled={!isConnected || !partnerId || isSkipping}
                className={styles.messageInput}
              />
              {/* {hasFilterWarning && (
                <div className={styles.filterWarning}>
                  Message contains sensitive content that will be filtered
                </div>
              )} */}
            </div>
            <button 
              type="submit" 
              disabled={!isConnected || !partnerId || !inputMessage.trim() || isSkipping}
              className={styles.sendButton}
            >
              Send
            </button>
          </form>
          <button 
            onClick={skipPartner} 
            className={styles.skipButton}
            disabled={(!isConnected && !partnerDisconnected) || isSkipping}
          >
            {isSkipping ? 'Skipping...' : partnerDisconnected ? 'Find New' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RouletteChat;