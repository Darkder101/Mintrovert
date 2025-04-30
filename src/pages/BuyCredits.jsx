// src/pages/BuyCredits.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './BuyCredits.module.css';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';

const BuyCredits = () => {
  const [loading, setLoading] = useState(false);
  const [showPurchaseFeedback, setShowPurchaseFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const navigate = useNavigate();

  const handlePurchase = (amount, method) => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setFeedbackMessage(`Successfully purchased ${amount} credits!`);
      setShowPurchaseFeedback(true);
      
      // Hide feedback after 3 seconds
      setTimeout(() => {
        setShowPurchaseFeedback(false);
      }, 3000);
    }, 1500);
  };

  const handleWatchAds = () => {
    setLoading(true);
    
    // Simulate watching ad
    setTimeout(() => {
      setLoading(false);
      setFeedbackMessage('Successfully earned 10 credits!');
      setShowPurchaseFeedback(true);
      
      // Hide feedback after 3 seconds
      setTimeout(() => {
        setShowPurchaseFeedback(false);
      }, 3000);
    }, 2000);
  };

  // Table data for features
  const featureData = [
    {
      icon: "💬",
      name: "Start Private Chat",
      credits: 20,
      details: "One-time unlock per person"
    },
    {
      icon: "🕵️",
      name: "Anonymous Confession",
      credits: 50,
      details: "Fully untraceable, stays anonymous forever"
    },
    {
      icon: "🎭",
      name: "Reveal Confessor",
      credits: 30,
      details: "Only if they didn't choose full anonymous"
    },
    {
      icon: "🚀",
      name: "Boost in Roulette",
      credits: 15,
      details: "Get matched faster and more often"
    },
    {
      icon: "⭐",
      name: "Highlight Message",
      credits: 10,
      details: "Pin your message in global chat for 10 mins"
    }
  ];

  return (
    <div className={styles.container}>
      <Navbar />
      
      <div className={styles.contentContainer}>
        <h1 className={styles.title}>Buy Credits</h1>
        
        <p className={styles.description}>
          Global chat, roulette, and reading confessions are always free.
          <br />
          Credits unlock premium ways to connect and express more freely!
        </p>
        
        <div className={styles.creditTable}>
          <div className={styles.tableHeader}>
            <div className={styles.featureColumn}>Feature</div>
            <div className={styles.creditColumn}>Credits</div>
            <div className={styles.detailsColumn}>Details</div>
          </div>
          
          {featureData.map((feature, index) => (
            <div key={index} className={styles.tableRow}>
              <div className={styles.featureColumn}>
                <span className={styles.featureIcon}>{feature.icon}</span> {feature.name}
              </div>
              <div className={styles.creditColumn}>{feature.credits}</div>
              <div className={styles.detailsColumn}>{feature.details}</div>
            </div>
          ))}
        </div>
        
        <div className={styles.purchaseOptions}>
          <div className={styles.purchaseCard}>
            <div className={styles.coinIcon}></div>
            <div className={styles.creditAmount}>50 Credits</div>
            <button 
              className={styles.purchaseButton}
              onClick={() => handlePurchase(50, 'money')}
            >
              Rs. 100/-
            </button>
          </div>
          
          <div className={styles.purchaseCard}>
            <div className={styles.coinIcon}></div>
            <div className={styles.creditAmount}>10 Credits</div>
            <button 
              className={styles.watchAdsButton}
              onClick={handleWatchAds}
            >
              Watch Ads
            </button>
          </div>
        </div>
        
        <p className={styles.disclaimer}>
          by registering phone number, i hereby agree and accept the Terms of Services and Privacy Policy in use of the IRL app.
        </p>
      </div>
      
      {loading && <LoadingSpinner />}
      
      {showPurchaseFeedback && (
        <div className={styles.feedbackMessage}>
          {feedbackMessage}
        </div>
      )}
    </div>
  );
};

export default BuyCredits;