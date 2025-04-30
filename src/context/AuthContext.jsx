// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Create the auth context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [anonName, setAnonName] = useState(null);
  const [avatarColor, setAvatarColor] = useState(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [isVerified, setIsVerified] = useState(false); // <-- NEW STATE

  useEffect(() => {
    // Set up the auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          let storedAnonName = sessionStorage.getItem('anonName');
          let storedAvatarColor = sessionStorage.getItem('avatarColor');

          const db = getFirestore();

          const userProfileDoc = await getDoc(doc(db, "userProfiles", user.uid));
          if (userProfileDoc.exists() && userProfileDoc.data().anonName) {
            storedAnonName = userProfileDoc.data().anonName;
            sessionStorage.setItem('anonName', storedAnonName);
          }

          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            storedAvatarColor = userData.avatarColor || (userData.gender === 'male' ? 'blue' : 'pink');

            sessionStorage.setItem('avatarColor', storedAvatarColor);

            // Check if user is verified
            setIsVerified(userData.isVerified === true);
          }
          
          if (storedAnonName) {
            setAnonName(storedAnonName);
            setProfileComplete(true);
          }

          if (storedAvatarColor) {
            setAvatarColor(storedAvatarColor);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        // Clear data when user logs out
        setAnonName(null);
        setAvatarColor(null);
        setIsVerified(false); // <-- reset isVerified
        sessionStorage.removeItem('anonName');
        sessionStorage.removeItem('avatarColor');
      }

      setLoading(false);
    });

    // Clean up the listener on unmount
    return unsubscribe;
  }, []);

  // Function to update profile completion status
  const updateProfileStatus = (status) => {
    setProfileComplete(status);
  };

  // Function to update anonymous name
  const updateAnonName = (name) => {
    setAnonName(name);
  };

  // Function to update avatar color
  const updateAvatarColor = (color) => {
    setAvatarColor(color);
    sessionStorage.setItem('avatarColor', color);
  };

  const value = {
    currentUser,
    profileComplete,
    updateProfileStatus,
    anonName,
    updateAnonName,
    avatarColor,
    updateAvatarColor,
    isVerified // <-- ADDED to value
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
