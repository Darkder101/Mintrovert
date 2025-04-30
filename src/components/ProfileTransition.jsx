// src/components/ProfileTransition.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import styles from './ProfileTransition.module.css';
import { useAuth } from '../context/AuthContext';

const ProfileTransition = ({ realName, anonName, onComplete }) => {
  const [stage, setStage] = useState('real');
  const [showContinue, setShowContinue] = useState(false);
  const navigate = useNavigate();
  const { avatarColor, updateAnonName } = useAuth();
  
  useEffect(() => {
    // Update the anonymous name in context when component mounts
    if (anonName) {
      updateAnonName(anonName);
    }
    
    // First stage: show real identity for 2 seconds
    const timer1 = setTimeout(() => {
      setStage('transition');
      
      // After a short delay, trigger confetti
      setTimeout(() => {
        launchConfetti();
      }, 500);
      
    }, 2000);
    
    // Second stage: show anonymous identity for 3.5 seconds
    const timer2 = setTimeout(() => {
      setStage('anon');
    }, 3000);
    
    // Final stage: show continue button
    const timer3 = setTimeout(() => {
      setShowContinue(true);
    }, 5500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [navigate, onComplete, anonName, updateAnonName]);
  
  const launchConfetti = () => {
    const duration = 2000;
    const end = Date.now() + duration;
    
    const colors = ['#7a9bff', '#ff7ac5', '#FFD700', '#9FE2BF'];
    
    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });
      
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  const handleContinue = () => {
    if (onComplete) {
      onComplete();
    } else {
      navigate('/global-chat');
    }
  };

  // Determine avatar style based on gender/color
  const getAvatarStyle = () => {
    if (avatarColor === 'blue') {
      return { background: 'linear-gradient(135deg, #c8d4f5 0%, #7a9bff 100%)' };
    } else {
      return { background: 'linear-gradient(135deg, #f5c8e8 0%, #ff7ac5 100%)' };
    }
  };

  return (
    <div className={styles.transitionContainer}>
      <div className={styles.bgAnimation}></div>
      
      <div className={styles.content}>
        <div className={styles.logoContainer}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>💬</span> Mintrovert
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          {stage === 'real' && (
            <motion.div 
              key="real"
              className={styles.identityCard}
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className={styles.title}>Welcome aboard!</h2>
              <div className={styles.avatarWrapper}>
                <div className={styles.avatar} style={getAvatarStyle()}>
                  <span className={styles.avatarText}>
                    {realName.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <h3 className={styles.realName}>{realName}</h3>
              <p className={styles.subtitle}>Your real profile is now set up!</p>
            </motion.div>
          )}
          
          {stage === 'transition' && (
            <motion.div 
              key="transition"
              className={styles.identityCard}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1, rotate: [0, 5, -5, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className={styles.title}>Transforming...</h2>
              <div className={styles.transformIcon}>
                <span className={styles.sparkle}>✨</span>
              </div>
              <p className={styles.subtitle}>Creating your anonymous identity...</p>
            </motion.div>
          )}
          
          {stage === 'anon' && (
            <motion.div 
              key="anon"
              className={`${styles.identityCard} ${styles.anonCard}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className={styles.title}>Meet your anonymous identity!</h2>
              <div className={styles.avatarWrapper}>
                <div className={`${styles.avatar} ${styles.anonAvatar}`} style={getAvatarStyle()}>
                  <span className={styles.avatarText}>
                    {anonName.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <h3 className={styles.anonName}>{anonName}</h3>
              <p className={styles.subtitle}>This is how others will see you in public chats</p>
              
              {showContinue && (
                <motion.button
                  className={styles.continueButton}
                  onClick={handleContinue}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  Continue
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill} 
          style={{ 
            width: stage === 'real' ? '33%' : stage === 'transition' ? '66%' : '100%',
            transition: 'width 0.5s ease-in-out'
          }}
        ></div>
      </div>
    </div>
  );
};

export default ProfileTransition;