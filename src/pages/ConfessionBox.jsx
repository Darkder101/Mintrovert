// src/pages/ConfessionBox.jsx
import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import styles from './ConfessionBox.module.css';
import { getDisplayName } from '../hooks/useAnonName';

const ConfessionBox = () => {
  const { currentUser, anonName } = useAuth();
  const [confessions, setConfessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewConfessionModal, setShowNewConfessionModal] = useState(false);
  const [showConfessionModal, setShowConfessionModal] = useState(false);
  const [selectedConfession, setSelectedConfession] = useState(null);
  const [newConfession, setNewConfession] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch confessions
  useEffect(() => {
    const confessionsRef = collection(db, 'confessions');
    const q = query(confessionsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedConfessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setConfessions(fetchedConfessions);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Submit new confession
  const handleSubmitConfession = async (e) => {
    e.preventDefault();
    if (!newConfession.trim()) return;
    
    setSubmitting(true);
    try {
      // Use the current user's anonymous name
      const posterAnonName = anonName || await getDisplayName(currentUser?.uid);
      
      await addDoc(collection(db, 'confessions'), {
        text: newConfession,
        timestamp: Timestamp.now(),
        anonName: posterAnonName,
        isNew: true // Flag to mark as new confession
      });
      
      setNewConfession('');
      setShowNewConfessionModal(false);
    } catch (error) {
      console.error("Error submitting confession:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Function to show the full confession in a modal
  const openConfession = (confession) => {
    setSelectedConfession(confession);
    setShowConfessionModal(true);
  };

  // Function to truncate text for preview
  const truncateText = (text, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength).trim() + '...';
  };

  // Function to render user avatar with anonymous name
  const renderAvatar = (anonName = 'Anonymous User') => {
    // Determine avatar color based on whether the name has "Blue" in it (just a simple example)
    const isBlueVariant = anonName.toLowerCase().includes('blue');
    
    return (
      <div className={styles.userAvatar}>
        <div 
          className={styles.avatarCircle}
          style={{ backgroundColor: isBlueVariant ? '#7a9bff' : '#ff9cad' }}
        ></div>
        <span className={styles.username}>{anonName}</span>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <Navbar />
      
      <div className={styles.confessionBoxHeader}>
        <h1>Confession Box</h1>
        <p>Share your thoughts anonymously with the community</p>
      </div>
      
      {loading ? (
        <div className={styles.loadingContainer}>
          <LoadingSpinner />
        </div>
      ) : (
        <div className={styles.confessionsGrid}>
          {confessions.map((confession) => (
            <div 
              key={confession.id} 
              className={`${styles.confessionCard} ${confession.isNew ? styles.newConfession : ''}`}
              onClick={() => openConfession(confession)}
            >
              <div className={styles.confessionContent}>
                {confession.isNew && <div className={styles.newBadge}>new</div>}
                <p>{truncateText(confession.text)}</p>
                {confession.text.length > 100 && (
                  <span className={styles.readMore}>Read more</span>
                )}
              </div>
              
              {renderAvatar(confession.anonName)}
              
              <div className={styles.confessionMeta}>
                <span className={styles.timestamp}>
                  {confession.timestamp?.toDate().toLocaleString() || 'Just now'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Floating action button */}
      <button 
        className={styles.newConfessionBtn}
        onClick={() => setShowNewConfessionModal(true)}
        aria-label="New Confession"
      >
        +
      </button>
      
      {/* New Confession Modal */}
      {showNewConfessionModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNewConfessionModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2>Share Your Confession</h2>
            <p>Your identity will remain anonymous as <strong>{anonName || 'Anonymous User'}</strong></p>
            
            <form onSubmit={handleSubmitConfession}>
              <textarea
                className={styles.confessionInput}
                placeholder="What would you like to confess today?"
                value={newConfession}
                onChange={(e) => setNewConfession(e.target.value)}
                rows={5}
                required
              />
              
              <div className={styles.modalActions}>
                <button 
                  type="button" 
                  className={styles.cancelBtn}
                  onClick={() => setShowNewConfessionModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={styles.submitBtn}
                  disabled={submitting || !newConfession.trim()}
                >
                  {submitting ? 'Posting...' : 'Post Confession'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* View Full Confession Modal */}
      {showConfessionModal && selectedConfession && (
        <div className={styles.modalOverlay} onClick={() => setShowConfessionModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.fullConfessionHeader}>
              {renderAvatar(selectedConfession.anonName)}
              <span className={styles.fullConfessionTimestamp}>
                {selectedConfession.timestamp?.toDate().toLocaleString() || 'Just now'}
              </span>
            </div>
            
            <div className={styles.fullConfessionBody}>
              <p>{selectedConfession.text}</p>
            </div>
            
            <button 
              className={styles.closeBtn} 
              onClick={() => setShowConfessionModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfessionBox;