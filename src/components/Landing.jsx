// src/components/Landing.jsx
import React, { useEffect, useRef } from 'react';
import styles from './Landing.module.css';
import { FaComments, FaUserSecret, FaLock, FaUsers, FaHeart } from 'react-icons/fa';

const Landing = ({ onRegister, onLogin }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
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
    

    return () => {
      // Cleanup if needed
    };
  }, []);

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.networkCanvas}></canvas>
      
      <div className={styles.content}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <FaComments />
          </div>
          <span className={styles.logoText}>Mintrovert</span>
        </div>
        
        <div className={styles.heroSection}>
          <h1 className={styles.title}>
            Connect <span className={styles.highlight}>Anonymously.</span><br/>
            Chat <span className={styles.highlight}>Securely.</span>
          </h1>
          
          <div className={styles.exclusiveTagContainer}>
            <div className={styles.exclusiveTag}>
              <span className={styles.exclusiveTagDot}></span>
              Exclusively for JSPM & TSSM College Students
            </div>
          </div>
          
          <p className={styles.subtitle}>
            Your private space for authentic conversations.
            No names. No traces. Just connections.
          </p>
          
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                <FaUserSecret className={styles.featureIcon} />
              </div>
              <h3>Anonymous Profile</h3>
              <p>Express yourself freely without revealing your identity</p>
            </div>
            
            <div className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                <FaLock className={styles.featureIcon} />
              </div>
              <h3>Private Chats</h3>
              <p>End-to-end encrypted messages that disappear</p>
            </div>
            
            <div className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                <FaUsers className={styles.featureIcon} />
              </div>
              <h3>Global Chatroom</h3>
              <p>Join campus-wide discussions on trending topics</p>
            </div>
            
            <div className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                <FaHeart className={styles.featureIcon} />
              </div>
              <h3>Connect</h3>
              <p>Find your match through anonymous conversations</p>
            </div>
          </div>
        </div>
        
        <div className={styles.actionArea}>
          <button className={styles.primaryButton} onClick={onRegister}>
            Get Started
          </button>
          <button className={styles.secondaryButton} onClick={onLogin}>
            Sign In
          </button>
        </div>
        
        <div className={styles.footer}>
          <p className={styles.footerText}>
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Landing;