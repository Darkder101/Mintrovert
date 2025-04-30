//src/components/NavbarMenu.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth, rtdb, db } from '../firebase/config';
import { ref, set, remove } from 'firebase/database';
import { doc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import styles from './NavbarMenu.module.css';

const NavbarMenu = ({ isOpen, onClose, credits = 100 }) => {
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Function to handle clicks outside the menu to close it
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && isOpen) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

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

  // Function to handle account deletion with authentication
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
        onClose();
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

  // Function to cancel delete confirmation
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteError(null);
    setUsername('');
    setPassword('');
  };

  // Menu items with their respective actions - Profile settings removed
  const menuItems = [
    {
      name: 'Roulette Chat',
      action: () => {
        navigate('/roulette-chat');
        onClose();
      },
    },
    {
      name: 'Confession Box',
      action: () => {
        navigate('/confession-box');
        onClose();
      },
    },
    {
      name: 'Buy Credits',
      action: () => {
        navigate('/buy-credits');
        onClose();
      },
    },
    {
      name: 'Help / Customer care',
      action: () => {
        navigate('/help');
        onClose();
      },
    },
    {
      name: 'Log out',
      action: async () => {
        try {
          // Remove the user from online users list before signing out
          const user = auth.currentUser;
          if (user) {
            const userStatusRef = ref(rtdb, `onlineUsers/${user.uid}`);
            await set(userStatusRef, null);
          }
          
          await signOut(auth);
          localStorage.clear();
          sessionStorage.clear();
          navigate('/login');
          onClose();
        } catch (error) {
          console.error('Error signing out:', error);
        }
      },
    },
    {
      name: 'Delete Account',
      action: () => {
        setShowDeleteConfirm(true);
      },
      className: styles.dangerItem
    }
  ];

  return (
    <>
      {/* Overlay that appears when menu is open */}
      <div 
        className={`${styles.navbarMenuOverlay} ${isOpen ? styles.show : ''}`} 
        onClick={onClose}
      />
      
      {/* Menu panel */}
      <div 
        ref={menuRef}
        className={`${styles.navbarMenu} ${isOpen ? styles.open : ''}`}
      >
        <div className={styles.navbarMenuHeader}>
          <div className={styles.navbarMenuCredits}>Credits: {credits}</div>
          <button className={styles.navbarMenuClose} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.navbarMenuItems}>
          {menuItems.map((item, index) => (
            <div 
              key={index}
              className={`${styles.navbarMenuItem} ${item.className || ''}`}
              onClick={item.action}
            >
              {item.name}
            </div>
          ))}
        </div>

        {/* Updated Delete Account Confirmation */}
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
    </>
  );
};

export default NavbarMenu;