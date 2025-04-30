// src/utils/adminUtils.js
import { getFirestore, collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Creates a verification request in Firestore for admin review
 * 
 * @param {string} userId - The user's UID
 * @param {object} userData - User data for verification
 * @param {File} idImage - The ID image file to upload
 * @returns {Promise<string>} - The request ID
 */
export const createVerificationRequest = async (userId, userData, idImage) => {
  try {
    const db = getFirestore();
    const storage = getStorage();
    
    // Upload ID image to storage if not already uploaded
    let idImagePath = null;
    let idImageUrl = userData.idImageUrl;
    
    if (idImage && !idImageUrl) {
      // Create a reference to the storage location
      const idImageRef = storageRef(storage, `verification/${userId}/id-${Date.now()}.jpg`);
      
      // Upload the file
      await uploadBytes(idImageRef, idImage);
      
      // Get the download URL
      idImageUrl = await getDownloadURL(idImageRef);
      idImagePath = idImageRef.fullPath;
    }
    
    // Create the verification request document
    const verificationData = {
      userId,
      name: userData.name,
      username: userData.username,
      gender: userData.gender,
      purpose: userData.purpose,
      phoneNumber: userData.phoneNumber,
      idImageUrl,
      idImagePath,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    // Add to verificationRequests collection
    const requestRef = await addDoc(collection(db, "verificationRequests"), verificationData);
    
    // Update user document to reference the verification request
    await setDoc(doc(db, "users", userId), {
      verificationRequestId: requestRef.id,
      verificationStatus: 'pending'
    }, { merge: true });
    
    return requestRef.id;
  } catch (error) {
    console.error("Error creating verification request:", error);
    throw error;
  }
};

/**
 * Updates a user's verification status
 * 
 * @param {string} userId - The user's UID
 * @param {boolean} isVerified - Whether the user is verified
 * @returns {Promise<void>}
 */
export const updateUserVerificationStatus = async (userId, isVerified) => {
  try {
    const db = getFirestore();
    await setDoc(doc(db, "users", userId), {
      isVerified,
      verifiedAt: isVerified ? new Date().toISOString() : null,
      verificationStatus: isVerified ? 'approved' : 'rejected'
    }, { merge: true });
  } catch (error) {
    console.error("Error updating verification status:", error);
    throw error;
  }
};

/**
 * Check if a user is verified
 * 
 * @param {string} userId - The user's UID
 * @returns {Promise<boolean>} - Whether the user is verified
 */
export const checkUserVerificationStatus = async (userId) => {
  try {
    const db = getFirestore();
    const userDoc = await doc(db, "users", userId);
    const userSnapshot = await userDoc.get();
    
    if (userSnapshot.exists()) {
      return userSnapshot.data().isVerified === true;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking verification status:", error);
    return false;
  }
};