// src/hooks/useAnonName.js
import { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

/**
 * A custom hook to get a user's anonymous name from Firestore
 * @param {string} uid - User ID to fetch anonymous name for
 * @returns {Object} - Anonymous name state and loading state
 */
const useAnonName = (uid) => {
  const [anonName, setAnonName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnonName = async () => {
      // Skip if no UID is provided
      if (!uid) {
        setLoading(false);
        return;
      }

      try {
        // First check if we have it in session storage
        const storedAnonName = sessionStorage.getItem(`anonName_${uid}`);
        
        if (storedAnonName) {
          setAnonName(storedAnonName);
          setLoading(false);
          return;
        }
        
        // If not in session storage, fetch from Firestore
        const db = getFirestore();
        const userProfileDoc = await getDoc(doc(db, "userProfiles", uid));
        
        if (userProfileDoc.exists() && userProfileDoc.data().anonName) {
          const fetchedAnonName = userProfileDoc.data().anonName;
          setAnonName(fetchedAnonName);
          
          // Store in session storage for future use
          sessionStorage.setItem(`anonName_${uid}`, fetchedAnonName);
        } else {
          setAnonName(null);
          setError('Anonymous name not found');
        }
      } catch (err) {
        console.error('Error fetching anonymous name:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnonName();
  }, [uid]);

  return { anonName, loading, error };
};

/**
 * Helper function to get an anonymous name for display
 * @param {string} uid - User ID to get anonymous name for
 * @returns {Promise<string>} - The user's anonymous name or a fallback
 */
export const getDisplayName = async (uid) => {
  if (!uid) return 'Unknown User';
  
  try {
    // Check session storage first
    const storedAnonName = sessionStorage.getItem(`anonName_${uid}`);
    
    if (storedAnonName) {
      return storedAnonName;
    }
    
    // If not in session storage, get from Firestore
    const db = getFirestore();
    const userProfileDoc = await getDoc(doc(db, "userProfiles", uid));
    
    if (userProfileDoc.exists() && userProfileDoc.data().anonName) {
      const fetchedAnonName = userProfileDoc.data().anonName;
      // Store for future use
      sessionStorage.setItem(`anonName_${uid}`, fetchedAnonName);
      return fetchedAnonName;
    }
    
    return 'Anonymous User';
  } catch (error) {
    console.error('Error getting display name:', error);
    return 'Anonymous User';
  }
};

export default useAnonName;