// src/pages/LoginPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './LoginPage.module.css';
import { IoArrowBack } from 'react-icons/io5';
import { FaComments, FaLock, FaUser } from 'react-icons/fa';
import { auth } from '../firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { updateProfileStatus } = useAuth();
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

    // Handle window resize
    const handleResize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Validate inputs
    if (!username.trim()) {
      setErrorMessage('Please enter your username');
      return;
    }
    
    if (!password.trim()) {
      setErrorMessage('Please enter your password');
      return;
    }
    
    // Clear previous errors
    setErrorMessage('');
    setIsLoading(true);
    
    try {
      // Convert username to email format for Firebase
      const email = `${username}@weconnect.app`;
      
      // Sign in with Firebase
      await signInWithEmailAndPassword(auth, email, password);
      
      console.log('User logged in successfully');
      updateProfileStatus(true);
      navigate('/global-chat');
    } catch (error) {
      console.error('Login error:', error);
      
      let message = 'Login failed. Please check your credentials.';
      
      if (error.code === 'auth/user-not-found') {
        message = 'User not found. Please check your username.';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many failed login attempts. Please try again later.';
      }
      
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className={styles.containerWrapper}>
      <canvas ref={canvasRef} className={styles.networkCanvas}></canvas>
      
      <div className={styles.container}>
        <div className={styles.backButtonContainer}>
          <div className={styles.backButton} onClick={handleBack}>
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
          
          <h1 className={styles.title}>Welcome <span className={styles.highlight}>Back</span></h1>
          <p className={styles.subtitle}>
            Sign in to continue your anonymous journey
          </p>
          
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.inputGroup}>
              <div className={styles.inputIconContainer}>
                <FaUser className={styles.inputIcon} />
              </div>
              <div className={styles.inputWrapper}>
                <label className={styles.inputLabel}>Username</label>
                <input
                  type="text"
                  className={styles.input}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className={styles.inputGroup}>
              <div className={styles.inputIconContainer}>
                <FaLock className={styles.inputIcon} />
              </div>
              <div className={styles.inputWrapper}>
                <label className={styles.inputLabel}>Password</label>
                <input
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            {errorMessage && (
              <p className={styles.errorText}>{errorMessage}</p>
            )}
            
            <button 
              type="submit" 
              className={styles.button}
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
            
            <p className={styles.termsText}>
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;