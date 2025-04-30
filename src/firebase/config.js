// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database"; // Add this import

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyADH3rEIkvs3a2SaFOD_dw3g-gaVf_yxK8",
  authDomain: "weconnect-e2c85.firebaseapp.com",
  projectId: "weconnect-e2c85",
  storageBucket: "weconnect-e2c85.firebasestorage.app",
  messagingSenderId: "771014627726",
  appId: "1:771014627726:web:f85dbb7017ad555e0d54df",
  measurementId: "G-GCFWS1BTDT",
  databaseURL: "https://weconnect-e2c85-default-rtdb.firebaseio.com/" // Add this line with your database URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const rtdb = getDatabase(app); // Initialize Realtime Database

export { auth, db, rtdb, app };