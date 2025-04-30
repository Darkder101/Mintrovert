// src/pages/HelpPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import NetworkBackground from '../components/NetworkBackground';
import styles from './HelpPage.module.css';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { MessageCircle, HelpCircle, Mail, Phone, Clock } from 'react-feather'; // Import icons

const HelpPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('support');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isNavOpen, setIsNavOpen] = useState(false);

  // Handler for navbar state with fixed z-index handling
  const handleNavToggle = (isOpen) => {
    setIsNavOpen(isOpen);
    
    // Apply or remove body overflow style based on nav state
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  };

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // FAQ data
  const faqs = [
    {
      question: 'How do I start a private chat?',
      answer: 'To start a private chat, go to the Global Chat page, click on a users profile, and select "Start Chat" from their profile card. Alternatively, you can directly navigate to the Private Chat section and select a user from your recent conversations.'
    },
    {
      question: 'What is Roulette Chat?',
      answer: 'Roulette Chat is a feature that randomly connects you with another online user for a one-on-one conversation. Its a great way to meet new people. Simply go to the Roulette Chat page and click "Start Matching" to be paired with someone.'
    },
    {
      question: 'What is the Confession Box?',
      answer: 'The Confession Box allows you to post anonymous messages that other users can respond to. Its a space to share thoughts or ask questions without revealing your identity.'
    },
    {
      question: 'How do credits work?',
      answer: 'Credits are used for premium features like profile boosts, custom avatars, and extended chat features. You can purchase credits from the "Buy Credits" section in the menu.'
    },
    {
      question: 'How can I change my profile information?',
      answer: 'Go to Profile Settings in the menu. From there, you can update your display name, bio, profile picture, and other personal information.'
    },
    {
      question: 'Is my data secure on WeConnect?',
      answer: 'Yes, we use encryption for all communications and follow strict data protection protocols. We never share your personal information with third parties without your consent.'
    }
  ];

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in all fields');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      await addDoc(collection(db, 'supportTickets'), {
        userId: currentUser.uid,
        userEmail: currentUser.email || currentUser.phoneNumber,
        subject,
        message,
        status: 'open',
        createdAt: serverTimestamp()
      });
      
      setSubject('');
      setMessage('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error('Error submitting support ticket:', err);
      setError('Failed to submit your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <NetworkBackground />
      <Navbar onMenuToggle={handleNavToggle} />
      
      <div className={`${styles.content} ${isNavOpen ? styles.contentBlurred : ''}`}>
        <div className={styles.card}>
          <div className={styles.headerSection}>
            <h1 className={styles.title}>Help & Support</h1>
            <p className={styles.subtitle}>Find answers or get assistance from our team</p>
          </div>
          
          <div className={styles.tabs}>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'support' ? styles.active : ''}`}
              onClick={() => handleTabChange('support')}
              disabled={isNavOpen}
            >
              <MessageCircle size={18} />
              <span>Contact Support</span>
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'faq' ? styles.active : ''}`}
              onClick={() => handleTabChange('faq')}
              disabled={isNavOpen}
            >
              <HelpCircle size={18} />
              <span>FAQ</span>
            </button>
          </div>
          
          <div className={styles.tabContent}>
            {activeTab === 'support' && (
              <div className={styles.supportForm}>
                <h2>Submit a Support Ticket</h2>
                <p>Our team will respond to your inquiry within 24 hours.</p>
                
                {success && (
                  <div className={styles.successMessage}>
                    <span>✓</span> Your support ticket has been submitted successfully!
                  </div>
                )}
                
                {error && (
                  <div className={styles.errorMessage}>
                    <span>!</span> {error}
                  </div>
                )}
                
                <form onSubmit={handleSubmit}>
                  <div className={styles.formGroup}>
                    <label htmlFor="subject">Subject</label>
                    <input
                      type="text"
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Enter the subject of your inquiry"
                      disabled={isSubmitting || isNavOpen}
                    />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="message">Message</label>
                    <textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your issue or question in detail"
                      rows="5"
                      disabled={isSubmitting || isNavOpen}
                    ></textarea>
                  </div>
                  
                  <button 
                    type="submit" 
                    className={styles.submitBtn}
                    disabled={isSubmitting || isNavOpen}
                  >
                    {isSubmitting ? <LoadingSpinner size="small" /> : 'Submit Ticket'}
                  </button>
                </form>
                
                <div className={styles.contactInfo}>
                  <h3>Other ways to reach us:</h3>
                  <div className={styles.contactMethods}>
                    <div className={styles.contactMethod}>
                      <Mail size={18} />
                      <div>
                        <strong>Email</strong>
                        <p>support@Mintrovert.com</p>
                      </div>
                    </div>
                    <div className={styles.contactMethod}>
                      <Phone size={18} />
                      <div>
                        <strong>Phone</strong>
                        <p>+1 (800) 123-4567</p>
                      </div>
                    </div>
                    <div className={styles.contactMethod}>
                      <Clock size={18} />
                      <div>
                        <strong>Hours</strong>
                        <p>Monday-Friday, 9AM-6PM EST</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'faq' && (
              <div className={styles.faqSection}>
                <h2>Frequently Asked Questions</h2>
                
                <div className={styles.searchBox}>
                  <input 
                    type="text" 
                    placeholder="Search for questions..." 
                    disabled={isNavOpen}
                  />
                </div>
                
                <div className={styles.faqList}>
                  {faqs.map((faq, index) => (
                    <details key={index} className={styles.faqItem}>
                      <summary>{faq.question}</summary>
                      <p>{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Overlay that blocks interaction with content when nav menu is open */}
      {isNavOpen && (
        <div 
          className={styles.pageOverlay} 
          onClick={() => handleNavToggle(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default HelpPage;