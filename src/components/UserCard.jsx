import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './UserCard.module.css';
import useAnonName from '../hooks/useAnonName';
import UserAvatar from './UserAvatar';

const UserCard = ({ user, showStatus = true, onClick, isActive }) => {
  const navigate = useNavigate();
  const { anonName, loading } = useAnonName(user.id || user.uid);
  
  // Use anonymous name if available, otherwise fall back to username/name
  const displayName = anonName || user.username || user.name || "Anonymous";

  const handleClick = () => {
    if (onClick) {
      onClick(user);
    } else if (user.uid || user.id) {
      navigate(`/private-chat/${user.uid || user.id}`);
    }
  };

  return (
    <div 
      className={`${styles.userCard} ${isActive ? styles.active : ''}`} 
      onClick={handleClick}
    >
      <UserAvatar 
        avatarColor={user.avatarColor || (user.gender === 'male' ? 'blue' : 'pink')} 
        profileImage={user.profileImage} 
        size="md" 
        showOnlineStatus={showStatus} 
        isOnline={user.isOnline} 
      />
      <div className={styles.userInfo}>
        <div className={styles.userName}>{displayName}</div>
        {user.purpose && <div className={styles.userPurpose}>{user.purpose}</div>}
      </div>
      
      {user.lastMessage && (
        <div className={styles.lastMessage}>
          <p className={styles.messageText}>{user.lastMessage.text}</p>
          {user.lastMessage.timestamp && (
            <span className={styles.messageTime}>
              {new Date(user.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
      
      {user.unreadCount > 0 && (
        <div className={styles.unreadBadge}>{user.unreadCount}</div>
      )}
      
      <button className={styles.optionsButton}>⋮</button>
    </div>
  );
};

export default UserCard;