import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/RegisterPage';
import OtpVerification from './pages/OtpVerification';
import LoginPage from './pages/LoginPage';
import ProfileSetup from './pages/ProfileSetup';
import GlobalChat from './pages/GlobalChat';
import PrivateChat from './pages/PrivateChat';
import RouletteChat from './pages/RouletteChat';
import ConfessionBox from './pages/ConfessionBox';
import BuyCredits from './pages/BuyCredits'; // Import the BuyCredits component
import HelpPage from './pages/HelpPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import usePresence from './hooks/usePresence';
import './App.css';

// Placeholder components for any remaining pages
const ProfileSettings = () => <div>Profile Settings Page</div>;

// Create a context for online users count
export const OnlineUsersContext = React.createContext(0);

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

// App Routes with Authentication check
const AppRoutes = () => {
  const { currentUser, profileComplete } = useAuth();
  const { onlineUsersCount } = usePresence(); // Use the presence hook

  return (
    <OnlineUsersContext.Provider value={onlineUsersCount}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={!currentUser ? <LandingPage /> : <Navigate to="/global-chat" />} />
        <Route path="/register" element={!currentUser ? <RegisterPage /> : <Navigate to="/global-chat" />} />
        <Route path="/login" element={!currentUser ? <LoginPage /> : <Navigate to="/global-chat" />} />
        <Route path="/verify-otp" element={!currentUser ? <OtpVerification /> : <Navigate to="/global-chat" />} />
        
        {/* Protected routes that require authentication */}
        <Route path="/profile-setup" element={
          <ProtectedRoute>
            <ProfileSetup />
          </ProtectedRoute>
        } />
        
        <Route path="/global-chat" element={
          <ProtectedRoute>
            <GlobalChat />
          </ProtectedRoute>
        } />
        
        <Route path="/private-chat" element={
          <ProtectedRoute>
            <PrivateChat />
          </ProtectedRoute>
        } />
        
        <Route path="/roulette-chat" element={
          <ProtectedRoute>
            <RouletteChat />
          </ProtectedRoute>
        } />
        
        <Route path="/profile" element={
          <ProtectedRoute>
            <ProfileSettings />
          </ProtectedRoute>
        } />
        
        <Route path="/confession-box" element={
          <ProtectedRoute>
            <ConfessionBox />
          </ProtectedRoute>
        } />
        
        <Route path="/buy-credits" element={
          <ProtectedRoute>
            <BuyCredits />
          </ProtectedRoute>
        } />
        
        <Route path="/help" element={
          <ProtectedRoute>
            <HelpPage />
          </ProtectedRoute>
        } />
        
        {/* Catch-all route for undefined paths */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </OnlineUsersContext.Provider>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;