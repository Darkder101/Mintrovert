// src/pages/ProfileSetup.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBack } from 'react-icons/io5';
import { FaCamera, FaUser } from 'react-icons/fa';
import { RiUserSettingsLine } from 'react-icons/ri';
import styles from './ProfileSetup.module.css';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase/config';
import { updateProfile, linkWithCredential, EmailAuthProvider } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getDatabase, ref, set, get } from 'firebase/database';

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { updateProfileStatus, updateAnonName } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    gender: '',
    purpose: '',
  });
  const [profileImage, setProfileImage] = useState(null);
  const [idImage, setIdImage] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showTransition, setShowTransition] = useState(false);
  const [generatedAnonName, setGeneratedAnonName] = useState('');

  useEffect(() => {
    const phoneNumber = sessionStorage.getItem('phoneNumber');
    if (!phoneNumber) navigate('/login');
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrorMessage('');
  };

  const handleGenderSelect = (gender) => {
    setFormData(prev => ({ ...prev, gender }));
  };

  const handlePurposeSelect = (purpose) => {
    setFormData(prev => ({ ...prev, purpose }));
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleIdImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setIdImage(file);
  };

  const validateForm = () => {
    if (!formData.name.trim()) return setErrorMessage('Name is required'), false;
    if (!formData.username.trim()) return setErrorMessage('Username is required'), false;
    if (!formData.password.trim()) return setErrorMessage('Password is required'), false;
    if (formData.password.length < 6) return setErrorMessage('Password must be at least 6 characters'), false;
    if (!formData.gender) return setErrorMessage('Please select your gender'), false;
    if (!formData.purpose) return setErrorMessage('Please select your purpose'), false;
    if (!idImage) return setErrorMessage('Please upload your college ID'), false;
    return true;
  };

  // Anonymous name generator
  const generateAnonName = () => {
    const colors = [
      'Blue', 'Red', 'Green', 'Purple', 'Yellow', 
      'Orange', 'Crimson', 'Emerald', 'Golden', 'Indigo',
      'Silver', 'Azure', 'Teal', 'Violet', 'Scarlet',
      'Coral', 'Amber', 'Lime', 'Ruby', 'Sapphire'
    ];
    
    const adjectives = [
      'Silent', 'Witty', 'Brave', 'Clever', 'Mighty',
      'Noble', 'Swift', 'Calm', 'Wise', 'Kind',
      'Bold', 'Sharp', 'Keen', 'Quick', 'Bright',
      'Great', 'Wild', 'Proud', 'Lucky', 'Gentle'
    ];
    
    const animals = [
      'Panther', 'Otter', 'Fox', 'Tiger', 'Falcon',
      'Wolf', 'Eagle', 'Bear', 'Lion', 'Hawk',
      'Dolphin', 'Owl', 'Rabbit', 'Hippo', 'Panda',
      'Koala', 'Leopard', 'Rhino', 'Shark', 'Deer',
      'Cat', 'Dog', 'Bat', 'Cow', 'Seal',
      'Goat', 'Horse', 'Pig', 'Duck', 'Swan',
      'Snake', 'Turtle', 'Mouse', 'Squirrel', 'Monkey',
      'Parrot', 'Robin', 'Crow', 'Dove', 'Frog',
      'Toad', 'Lizard', 'Chicken', 'Fish', 'Whale',
      'Sloth', 'Goldfish', 'Moth', 'Ant', 'Bee'
    ];
    
    const pick = (array) => array[Math.floor(Math.random() * array.length)];
    
    // Create two possible combinations: color+animal or adjective+animal
    const usesColor = Math.random() > 0.5;
    const word1 = usesColor ? pick(colors) : pick(adjectives);
    const word2 = pick(animals);
    
    return `${word1}${word2}`;
  };

  // Check if anonymous name is available and generate a new one if needed
  const getUniqueAnonName = async () => {
    let isUnique = false;
    let anonName = '';
    const rtdb = getDatabase();
    
    while (!isUnique) {
      anonName = generateAnonName();
      // Check if name exists in the database
      const nameRef = ref(rtdb, `/anonNamesUsed/${anonName}`);
      const snapshot = await get(nameRef);
      
      if (!snapshot.exists()) {
        isUnique = true;
      }
    }
    
    return anonName;
  };

  // Save anonymous name to Firebase
  const saveAnonName = async (uid, anonName) => {
    const db = getFirestore();
    const rtdb = getDatabase();
    
    // Save to Firestore userProfiles
    await setDoc(doc(db, "userProfiles", uid), {
      anonName: anonName
    }, { merge: true });
    
    // Mark as used in Realtime Database
    await set(ref(rtdb, `/anonNamesUsed/${anonName}`), true);
    
    // Store in session for current use
    sessionStorage.setItem('anonName', anonName);
    
    // Update context
    updateAnonName(anonName);
    
    return anonName;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      // Get the currently authenticated user (from phone auth)
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('No authenticated user found. Please verify phone number first.');
      }
      
      // Create email credential
      const email = `${formData.username}@weconnect.app`;
      const credential = EmailAuthProvider.credential(email, formData.password);
      
      // Link the phone auth with email/password
      await linkWithCredential(user, credential);
      
      // Update profile with display name
      await updateProfile(user, {
        displayName: formData.name
      });
      
      // Generate unique anonymous name
      const anonName = await getUniqueAnonName();
      setGeneratedAnonName(anonName);
      
      // Determine avatar color based on gender
      const avatarColor = formData.gender === 'male' ? 'blue' : 'pink';
      
      // Store user data in Firestore
      const db = getFirestore();
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        username: formData.username,
        name: formData.name,
        gender: formData.gender,
        avatarColor: avatarColor, // Store the gender-based avatar color
        purpose: formData.purpose,
        phoneNumber: sessionStorage.getItem('phoneNumber'),
        createdAt: new Date().toISOString(),
      });
      
      // Save anonymous name - make sure it gets stored in all places
      await saveAnonName(user.uid, anonName);
      
      // Update auth context with the new anonName
      updateAnonName(anonName);
      
      // Store the avatar color in session storage immediately
      sessionStorage.setItem('avatarColor', avatarColor);
      
      console.log('Profile submitted successfully!');
      updateProfileStatus(true);
      
      // Show the transition animation
      setShowTransition(true);
      
    } catch (error) {
      console.error('Error submitting profile:', error);
      if (error.code === 'auth/email-already-in-use') {
        setErrorMessage('Username already taken. Please try another.');
      } else if (error.code === 'auth/requires-recent-login') {
        setErrorMessage('For security, please verify your phone number again.');
        navigate('/register');
      } else {
        setErrorMessage('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Set placeholder style based on gender selection
  const getProfilePlaceholderStyle = () => {
    if (!formData.gender) {
      return {};
    }
    
    return {
      background: formData.gender === 'male' 
        ? 'linear-gradient(135deg, #c8d4f5 0%, #7a9bff 100%)' 
        : 'linear-gradient(135deg, #f5c8e8 0%, #ff7ac5 100%)'
    };
  };

  // If transition is shown, don't render the form
  if (showTransition) {
    // We'll import the ProfileTransition component dynamically to avoid issues
    const ProfileTransition = React.lazy(() => import('../components/ProfileTransition'));
    
    return (
      <React.Suspense fallback={<div className={styles.loading}>Loading...</div>}>
        <ProfileTransition 
          realName={formData.name}
          anonName={generatedAnonName}
          onComplete={() => navigate('/global-chat')}
        />
      </React.Suspense>
    );
  }

  return (
    <div className={styles.containerWrapper}>
      <div className={styles.bgAnimation}></div>
      <div className={styles.container}>
        <div className={styles.backButtonContainer}>
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            <IoArrowBack size={22} />
          </button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.logoContainer}>
            <div className={styles.logo}>
              <span className={styles.logoIcon}>💬</span> Mintrovert
            </div>
          </div>
          
          <div className={styles.headerContent}>
            <h1 className={styles.title}>
              <RiUserSettingsLine className={styles.titleIcon} />
              Create <span className={styles.gradientText}>Your Profile</span>
            </h1>
            <p className={styles.subtitle}>Enter your real details. It will be verified later.</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {/* Profile Image Upload */}
            <div className={styles.profileImageContainer}>
              <div className={styles.profileImageWrapper}>
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className={styles.profilePreview} />
                ) : (
                  <div className={styles.profilePlaceholder} style={getProfilePlaceholderStyle()}>
                    <FaUser className={styles.userIcon} style={formData.gender ? { color: 'white' } : {}} />
                  </div>
                )}
                <label htmlFor="profile-upload" className={styles.cameraIconWrapper}>
                  <FaCamera className={styles.cameraIcon} />
                </label>
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                  className={styles.fileInput}
                />
              </div>
            </div>

            {/* Name, Username, Password */}
            <div className={styles.formSection}>
              <h3 className={styles.sectionTitle}>Basic Information</h3>
              
              {['name', 'username', 'password'].map((field) => (
                <div className={styles.formGroup} key={field}>
                  <label className={styles.label}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                  <input
                    type={field === 'password' ? 'password' : 'text'}
                    name={field}
                    value={formData[field]}
                    onChange={handleInputChange}
                    placeholder={`Enter your ${field}`}
                    className={styles.input}
                  />
                </div>
              ))}
            </div>
            
            {/* Additional Details Section */}
            <div className={styles.formSection}>
              <h3 className={styles.sectionTitle}>Additional Details</h3>
              
              {/* Gender */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Gender</label>
                <div className={styles.radioGroup}>
                  {[
                    { id: 'male', label: 'Male', color: '#7a9bff' },
                    { id: 'female', label: 'Female', color: '#ff7ac5' }
                  ].map((g) => (
                    <div 
                      className={`${styles.radioOption} ${formData.gender === g.id ? styles.radioOptionSelected : ''}`} 
                      key={g.id}
                      onClick={() => handleGenderSelect(g.id)}
                      style={formData.gender === g.id ? {
                        borderColor: g.color,
                        background: `linear-gradient(135deg, ${g.color}15 0%, ${g.color}25 100%)`
                      } : {}}
                    >
                      <input
                        type="radio"
                        id={g.id}
                        name="gender"
                        checked={formData.gender === g.id}
                        onChange={() => {}}
                        className={styles.radioInput}
                      />
                      <label htmlFor={g.id} className={styles.radioLabel}>
                        {g.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Purpose */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Purpose <span className={styles.smallText}>(visible to others)</span>
                </label>
                <div className={styles.radioGroupVertical}>
                  {[
                    { id: 'casual', label: 'Casual Meet' },
                    { id: 'friends', label: 'Find Friends' },
                    { id: 'chat', label: 'Random Chats' }
                  ].map((p) => (
                    <div 
                      className={`${styles.radioOption} ${formData.purpose === p.id ? styles.radioOptionSelected : ''}`} 
                      key={p.id}
                      onClick={() => handlePurposeSelect(p.id)}
                    >
                      <input
                        type="radio"
                        id={p.id}
                        name="purpose"
                        checked={formData.purpose === p.id}
                        onChange={() => {}}
                        className={styles.radioInput}
                      />
                      <label htmlFor={p.id} className={styles.radioLabel}>
                        {p.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upload College ID */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Upload ID <span className={styles.smallText}>(strictly for verification)</span>
                </label>
                <div className={styles.uploadWrapper}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleIdImageChange}
                    className={styles.fileInputHidden}
                    id="id-upload"
                  />
                  <label htmlFor="id-upload" className={styles.uploadButton}>
                    {idImage ? 'Change File' : 'Upload ID'}
                  </label>
                  <span className={styles.uploadFileName}>
                    {idImage ? idImage.name : 'No file chosen'}
                  </span>
                </div>
                {/* Add verification info message */}
                <div className={styles.verificationInfo}>
                  <span className={styles.infoIcon}>ℹ️</span>
                  <p className={styles.infoText}>
                    Your ID will only be used to verify you are a JSPM/TSSM student and will be deleted after verification.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

            {/* Submit Button */}
            <button type="submit" className={styles.submitButton} disabled={isLoading}>
              {isLoading ? 'Creating Profile...' : 'Create Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;