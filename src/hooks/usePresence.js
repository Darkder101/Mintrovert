// src/hooks/usePresence.js
import { useState, useEffect } from 'react';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { rtdb, auth } from '../firebase/config';

const usePresence = () => {
  const [onlineUsersCount, setOnlineUsersCount] = useState(0);

  useEffect(() => {
    // Reference to the online users in the Realtime Database
    const onlineUsersRef = ref(rtdb, 'onlineUsers');
    
    // Listen for changes in the online users count
    const unsubscribe = onValue(ref(rtdb, '.info/connected'), (snapshot) => {
      // If we're connected (authenticated)
      if (snapshot.val() === true && auth.currentUser) {
        const uid = auth.currentUser.uid;
        const userStatusRef = ref(rtdb, `onlineUsers/${uid}`);
        
        // Create a reference to the user's status
        const userStatusInfo = {
          uid: uid,
          displayName: auth.currentUser.displayName || null,
          lastOnline: serverTimestamp(),
          status: 'online'
        };
        
        // When this device disconnects, update the user status
        onDisconnect(userStatusRef).remove();
        
        // Set the user as online
        set(userStatusRef, userStatusInfo);
      }
    });

    // Listen for changes in the online users count
    const countSubscription = onValue(onlineUsersRef, (snapshot) => {
      if (snapshot.exists()) {
        const count = Object.keys(snapshot.val()).length;
        setOnlineUsersCount(count);
      } else {
        setOnlineUsersCount(0);
      }
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      countSubscription();
    };
  }, []);

  return { onlineUsersCount };
};

export default usePresence;