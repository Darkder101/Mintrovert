// src/pages/OtpVerification.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './OtpVerification.module.css';
import { IoArrowBack } from 'react-icons/io5';
import { auth } from '../firebase/config';
import { FaShieldAlt } from 'react-icons/fa';

const OtpVerification = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [isResendActive, setIsResendActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef([]);

  const navigate = useNavigate();
  const phoneNumber = sessionStorage.getItem('phoneNumber');
  
  useEffect(() => {
    // Focus first input
    inputRefs.current = Array(6).fill().map((_, i) => inputRefs.current[i] || React.createRef());
    
    // Check if we have the phone number and confirmationResult
    if (!phoneNumber || !window.confirmationResult) {
      setErrorMessage('Session expired. Please try registering again.');
      return;
    }
    
    if (inputRefs.current[0].current) {
      inputRefs.current[0].current.focus();
    }

    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setIsResendActive(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phoneNumber]);

  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setErrorMessage('');
    if (value && index < 5) {
      inputRefs.current[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace navigation
    if (e.key === 'Backspace' && index > 0 && !otp[index]) {
      inputRefs.current[index - 1].current.focus();
    }
  };

  const handleResendOTP = () => {
    if (!isResendActive) return;
    
    // Navigate back to register page to resend OTP
    navigate('/register');
  };

  const handleVerification = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setErrorMessage('Enter valid 6-digit OTP');
      return;
    }

    if (!window.confirmationResult) {
      setErrorMessage('Session expired. Please try registering again.');
      return;
    }

    setIsLoading(true);
    try {
      await window.confirmationResult.confirm(otpValue);
      navigate('/profile-setup');
    } catch (error) {
      console.error(error);
      setErrorMessage('Invalid OTP. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
              <span className={styles.logoIcon}>💬</span> WeConnect
            </div>
          </div>
          
          <div className={styles.headingContainer}>
            <h2 className={styles.title}>
              <span className={styles.iconWrapper}>
                <FaShieldAlt />
              </span>
              Verify <span className={styles.gradientText}>Your Number</span>
            </h2>
            <p className={styles.subtitle}>
              Enter the 6-digit code sent to <strong>{phoneNumber}</strong>
            </p>
            <div className={styles.securityNote}>
              <span className={styles.securityIcon}>🔒</span>
              Your number stays private
            </div>
          </div>

          <div className={styles.otpContainer}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs.current[index]}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={styles.otpInput}
                disabled={isLoading}
              />
            ))}
          </div>

          {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}

          <button
            className={styles.verifyButton}
            onClick={handleVerification}
            disabled={isLoading}
          >
            {isLoading ? 'Verifying...' : 'Verify OTP'}
          </button>

          <p className={styles.resendText}>
            Didn't receive the code?{' '}
            <span 
              className={`${styles.resendLink} ${!isResendActive ? styles.resendLinkDisabled : styles.resendLinkActive}`}
              onClick={handleResendOTP}
            >
              {isResendActive ? 'Resend OTP' : `Resend in ${timer}s`}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default OtpVerification;