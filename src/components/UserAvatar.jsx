// src/components/UserAvatar.jsx
import React from 'react';
import { FaUser } from 'react-icons/fa';
import styles from './UserAvatar.module.css';

const UserAvatar = ({ 
  avatarColor = 'blue', 
  profileImage = null, 
  size = 'md', 
  className = '',
  showOnlineStatus = false,
  isOnline = false
}) => {
  // Define size classes
  const sizeClasses = {
    xs: styles.extraSmall,
    sm: styles.small,
    md: styles.medium,
    lg: styles.large,
    xl: styles.extraLarge
  };
  
  // Get background gradient based on avatar color
  const getBackgroundStyle = () => {
    if (avatarColor === 'blue') {
      return styles.maleBackground;
    } else if (avatarColor === 'pink') {
      return styles.femaleBackground;
    }
    return styles.defaultBackground;
  };
  
  return (
    <div className={`${styles.avatarContainer} ${sizeClasses[size]} ${className}`}>
      {profileImage ? (
        <img src={profileImage} alt="User" className={styles.avatarImage} />
      ) : (
        <div className={`${styles.avatarPlaceholder} ${getBackgroundStyle()}`}>
          <FaUser className={styles.userIcon} />
        </div>
      )}
      
      {showOnlineStatus && (
        <span className={`${styles.onlineIndicator} ${isOnline ? styles.online : styles.offline}`} />
      )}
    </div>
  );
};

export default UserAvatar;