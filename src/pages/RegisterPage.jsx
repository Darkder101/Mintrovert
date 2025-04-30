// src/pages/RegisterPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './RegisterPage.module.css';
import { IoArrowBack } from 'react-icons/io5';
import { FaComments, FaPhone, FaShieldAlt } from 'react-icons/fa';
import { auth } from '../firebase/config';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const RegisterPage = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  useEffect(() => {
    // Network animation
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const nodes = [];
    const lines = [];
    const numNodes = 30;

    // Create nodes
    for (let i = 0; i < numNodes; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2 + 1,
        vx: Math.random() * 0.5 - 0.25,
        vy: Math.random() * 0.5 - 0.25
      });
    }

    // Create connections
    for (let i = 0; i < numNodes; i++) {
      for (let j = i + 1; j < numNodes; j++) {
        if (Math.random() > 0.95) {
          lines.push([i, j]);
        }
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw lines
      ctx.strokeStyle = 'rgba(114, 137, 218, 0.15)';
      lines.forEach(line => {
        const nodeA = nodes[line[0]];
        const nodeB = nodes[line[1]];
        ctx.beginPath();
        ctx.moveTo(nodeA.x, nodeA.y);
        ctx.lineTo(nodeB.x, nodeB.y);
        ctx.stroke();
      });

      // Draw and update nodes
      nodes.forEach(node => {
        ctx.fillStyle = 'rgba(114, 137, 218, 0.6)';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();

        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off edges
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
      });

      requestAnimationFrame(animate);
    };

    animate();

    // Clear any previous recaptcha instances
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
    
    // Create a new recaptcha verifier instance
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        console.log('reCAPTCHA verified');
      },
      'expired-callback': () => {
        console.log('reCAPTCHA expired');
        setErrorMessage('Verification expired. Please try again.');
        setIsLoading(false);
      }
    });

    return () => {
      // Cleanup
    };
  }, []);

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    if (value && !/^\d+$/.test(value)) return;
    setPhoneNumber(value);
    setErrorMessage('');
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();

    if (!phoneNumber || phoneNumber.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    try {
      const formattedPhone = `+91${phoneNumber}`;

      // Get the appVerifier instance
      const appVerifier = window.recaptchaVerifier;

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        appVerifier
      );

      window.confirmationResult = confirmationResult;
      sessionStorage.setItem('phoneNumber', formattedPhone);
      navigate('/verify-otp');
    } catch (error) {
      console.error('Error sending OTP:', error);
      setErrorMessage('Failed to send OTP. Try again.');
      
      // Reset reCAPTCHA on error
      try {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            console.log('reCAPTCHA reverified');
          }
        });
      } catch (recaptchaError) {
        console.error('Error resetting reCAPTCHA:', recaptchaError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <canvas ref={canvasRef} className={styles.networkCanvas}></canvas>
      
      <div className={styles.contentBox}>
        <div className={styles.backButtonContainer}>
          <div className={styles.backButton} onClick={() => navigate('/')}>
            <IoArrowBack size={20} />
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <FaComments />
            </div>
            <span className={styles.logoText}>Mintrovert</span>
          </div>
          
          <h1 className={styles.title}>
            Find Out <span className={styles.highlight}>Who Has a Crush</span> On You
          </h1>

          <div className={styles.securityBadge}>
            <div className={styles.badgeIcon}>
              <FaShieldAlt />
            </div>
            <span>Your number stays private</span>
          </div>

          <p className={styles.description}>
            Enter your phone number to verify you're a JSPM/TSSM student.
            We never share your contact information.
          </p>

          <form onSubmit={handleSendOTP} className={styles.form}>
            <div className={styles.phoneInputGroup}>
              <div className={styles.phoneIconContainer}>
                <FaPhone className={styles.phoneIcon} />
              </div>
              <div className={styles.phoneInputContainer}>
                <div className={styles.countryCode}>+91</div>
                <input
                  type="text"
                  className={styles.phoneInput}
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="Enter your number"
                  maxLength={10}
                  disabled={isLoading}
                />
              </div>
            </div>

            {errorMessage && (
              <p className={styles.errorText}>{errorMessage}</p>
            )}

            {/* reCAPTCHA container */}
            <div id="recaptcha-container"></div>

            <button
              type="submit"
              className={styles.sendOtpButton}
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Verification Code'}
            </button>

            <p className={styles.termsText}>
              By registering, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;