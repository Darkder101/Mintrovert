// Navbar.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';
import { FaRandom, FaComment, FaCreditCard, FaHeadset, FaSignOutAlt, FaTrash } from 'react-icons/fa';
import { auth, rtdb, db } from '../firebase/config';
import { signOut, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { OnlineUsersContext } from '../App'; // Import the context
import { ref, set, remove } from 'firebase/database';
import { doc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser, anonName } = useAuth(); // Get anonName from AuthContext
  const onlineUsersCount = useContext(OnlineUsersContext); // Use the context

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const handleLogout = async () => {
    try {
      // Remove the user from online users list before signing out
      if (currentUser) {
        const userStatusRef = ref(rtdb, `onlineUsers/${currentUser.uid}`);
        await set(userStatusRef, null);
      }
      
      await signOut(auth);
      console.log('User signed out');
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Function to handle account deletion
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setDeleteError(null);
    
    try {
      const user = auth.currentUser;
      if (user) {
        // Get user document to verify username
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (!userDoc.exists()) {
          throw new Error("User data not found");
        }
        
        const userData = userDoc.data();
        
        // Check if the provided username matches the stored username
        if (userData.username !== username) {
          throw { code: 'auth/wrong-username', message: "Username doesn't match" };
        }

        // Create a credential with the constructed email and password
        const email = `${username}@weconnect.app`;
        const credential = EmailAuthProvider.credential(email, password);
        
        // Reauthenticate the user
        await reauthenticateWithCredential(user, credential);
        
        // Clean up all user data
        await cleanupUserData(user.uid, userData.anonName);
        
        // Remove the user from online users list before deleting
        const userStatusRef = ref(rtdb, `onlineUsers/${user.uid}`);
        await remove(userStatusRef);
        
        // Delete the user account after successful cleanup
        await deleteUser(user);
        localStorage.clear();
        sessionStorage.clear();
        navigate('/login');
        setIsMenuOpen(false);
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      
      // Set a more user-friendly error message
      if (error.code === 'auth/wrong-password') {
        setDeleteError("Incorrect password. Please try again.");
      } else if (error.code === 'auth/wrong-username') {
        setDeleteError("Username doesn't match. Please enter the username you registered with.");
      } else if (error.code === 'auth/user-mismatch') {
        setDeleteError("Credentials don't match current user.");
      } else if (error.code === 'auth/too-many-requests') {
        setDeleteError("Too many unsuccessful attempts. Please try again later.");
      } else {
        setDeleteError(error.message || "Failed to delete account. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Function to clean up all user data from the database
  const cleanupUserData = async (userId, anonName) => {
    try {
      // 1. Delete from Firestore users collection
      await deleteDoc(doc(db, "users", userId));
      
      // 2. Delete from userProfiles collection
      await deleteDoc(doc(db, "userProfiles", userId));
      
      // 3. Delete user's confessions
      const confessionsQuery = query(collection(db, "confessions"), where("userId", "==", userId));
      const confessionsSnapshot = await getDocs(confessionsQuery);
      const deleteConfessionPromises = [];
      confessionsSnapshot.forEach((doc) => {
        deleteConfessionPromises.push(deleteDoc(doc.ref));
      });
      await Promise.all(deleteConfessionPromises);
      
      // 4. Delete user's private chats
      // First, get all private chats where user is involved
      const privateChatsQuery = query(collection(db, "privateChats"), where("participants", "array-contains", userId));
      const privateChatsSnapshot = await getDocs(privateChatsQuery);
      const deletePrivateChatPromises = [];
      privateChatsSnapshot.forEach((doc) => {
        deletePrivateChatPromises.push(deleteDoc(doc.ref));
        // Also delete all messages in this chat
        const chatMessagesRef = collection(db, "privateChats", doc.id, "messages");
        deletePrivateChatPromises.push(deleteCollection(chatMessagesRef));
      });
      await Promise.all(deletePrivateChatPromises);
      
      // 5. Remove anonName from used names in RTDB
      if (anonName) {
        const anonNameRef = ref(rtdb, `anonNamesUsed/${anonName}`);
        await remove(anonNameRef);
      }
      
      // 6. Remove any other user data in RTDB
      const userRtdbRef = ref(rtdb, `users/${userId}`);
      await remove(userRtdbRef);
      
      console.log("User data cleanup completed successfully");
    } catch (error) {
      console.error("Error cleaning up user data:", error);
      throw error;
    }
  };

  // Helper function to delete a collection
  const deleteCollection = async (collectionRef) => {
    const snapshot = await getDocs(collectionRef);
    const deletePromises = [];
    snapshot.forEach((doc) => {
      deletePromises.push(deleteDoc(doc.ref));
    });
    return Promise.all(deletePromises);
  };

  // Function to cancel delete confirmation
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteError(null);
    setUsername('');
    setPassword('');
  };

  // Get the first character for avatar - prioritize anonName over displayName
  const getAvatarInitial = () => {
    if (anonName) {
      // Find the first capital letter in the anonName (which should be the start of either color/adjective or animal)
      const capitals = anonName.match(/[A-Z]/g);
      return capitals && capitals.length > 0 ? capitals[0] : anonName.charAt(0);
    }
    
    if (currentUser?.displayName) {
      return currentUser.displayName.charAt(0).toUpperCase();
    }
    
    return '?';
  };

  return (
    <div className={styles.navbar}>
      <div className={styles.logoContainer}>
        <div className={styles.logo} onClick={() => handleNavigation('/global-chat')}>
          Mintrovert
        </div>
      </div>

      <div className={styles.tabs}>
        <div 
          className={styles.tab}
          onClick={() => handleNavigation('/global-chat')}
        >
          Global
        </div>
        <div 
          className={styles.tab}
          onClick={() => handleNavigation('/private-chat')}
        >
          Private
        </div>
        <div className={styles.onlineCount}>
          {onlineUsersCount} Online
        </div>
      </div>

      {/* Make sure the hamburger icon is always visible */}
      <div className={styles.hamburger} onClick={toggleMenu}>
        <div className={styles.hamburgerLine}></div>
        <div className={styles.hamburgerLine}></div>
        <div className={styles.hamburgerLine}></div>
      </div>

      {isMenuOpen && (
        <div className={styles.menuOverlay} onClick={toggleMenu}>
          <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
            <div className={styles.menuHeader}>
              <div className={styles.menuClose} onClick={toggleMenu}>×</div>
            </div>
            
            {currentUser && (
              <div className={styles.userInfo}>
                <div className={styles.userAvatar}>
                  {getAvatarInitial()}
                </div>
                <div className={styles.userName}>
                  {/* Display anonymous name if available, otherwise fall back to display name or phone number */}
                  {anonName || currentUser.displayName || currentUser.phoneNumber || 'User'}
                </div>
              </div>
            )}
            
            <div className={styles.menuItems}>
              {/* Profile option removed */}
              
              <div className={styles.menuItem} onClick={() => handleNavigation('/roulette-chat')}>
                <FaRandom className={styles.menuIcon} />
                <span>Roulette Chat</span>
              </div>
              
              <div className={styles.menuItem} onClick={() => handleNavigation('/confession-box')}>
                <FaComment className={styles.menuIcon} />
                <span>Confession Box</span>
              </div>
              
              <div className={styles.menuItem} onClick={() => handleNavigation('/buy-credits')}>
                <FaCreditCard className={styles.menuIcon} />
                <span>Buy Credits</span>
              </div>
              
              <div className={styles.menuItem} onClick={() => handleNavigation('/help')}>
                <FaHeadset className={styles.menuIcon} />
                <span>Help & Support</span>
              </div>
              
              {currentUser && (
                <div className={styles.menuItem} onClick={handleLogout}>
                  <FaSignOutAlt className={styles.menuIcon} />
                  <span>Logout</span>
                </div>
              )}
              
              {currentUser && (
                <div className={`${styles.menuItem} ${styles.dangerItem}`} onClick={() => setShowDeleteConfirm(true)}>
                  <FaTrash className={styles.menuIcon} />
                  <span>Delete Account</span>
                </div>
              )}
            </div>
            
            {/* Updated Delete Account Confirmation Dialog */}
            {showDeleteConfirm && (
              <div className={styles.deleteConfirmOverlay}>
                <div className={styles.deleteConfirmBox}>
                  <h3>Delete Account</h3>
                  <p>To confirm account deletion, please enter your username and password:</p>
                  
                  {deleteError && (
                    <div className={styles.errorMessage}>
                      {deleteError}
                    </div>
                  )}
                  
                  <form onSubmit={handleDeleteAccount}>
                    <div className={styles.inputGroup}>
                      <label htmlFor="username">Username</label>
                      <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        placeholder="Enter your username"
                        className={styles.input}
                      />
                    </div>
                    
                    <div className={styles.inputGroup}>
                      <label htmlFor="password">Password</label>
                      <input
                        type="password"
                        id="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Enter your password"
                        className={styles.input}
                      />
                    </div>
                    
                    <div className={styles.deleteConfirmNote}>
                      This action cannot be undone and will permanently delete your account and all associated data.
                    </div>
                    
                    <div className={styles.deleteConfirmButtons}>
                      <button 
                        type="button"
                        className={styles.cancelButton}
                        onClick={cancelDelete}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        className={styles.deleteButton}
                        disabled={isLoading}
                      >
                        {isLoading ? "Deleting..." : "Delete Permanently"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Navbar;