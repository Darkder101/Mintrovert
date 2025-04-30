//src/pages/LandingPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Landing from '../components/Landing';
import styles from './LandingPage.module.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleRegister = () => {
    navigate('/register');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <div className={styles.pageContainer}>
      <Landing onRegister={handleRegister} onLogin={handleLogin} />
    </div>
  );
};

export default LandingPage;