// src/components/Register.jsx
import React, { useState } from 'react';
import styles from './Register.module.css';

const Register = ({ onSendOTP }) => {
  const [phoneNumber, setPhoneNumber] = useState('+91');
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const validatePhone = (number) => {
    // Check if the number is valid (10 digits after +91)
    const isValidNumber = /^\+91\d{10}$/.test(number);
    
    setIsValid(isValidNumber);
    if (!isValidNumber) {
      setErrorMessage('Please enter a valid 10-digit number');
    } else {
      setErrorMessage('');
    }
    
    return isValidNumber;
  };

  const handlePhoneChange = (e) => {
    let value = e.target.value;
    
    // Ensure the value always starts with +91
    if (!value.startsWith('+91')) {
      value = '+91' + value.replace('+91', '');
    }
    
    // Remove non-digit characters after +91
    const prefix = '+91';
    const numberPart = value.substring(3).replace(/\D/g, '');
    
    // Limit to +91 followed by 10 digits
    const formattedValue = prefix + numberPart.substring(0, 10);
    
    setPhoneNumber(formattedValue);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validatePhone(phoneNumber)) {
      onSendOTP(phoneNumber);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h2 className={styles.title}>Register to find</h2>
        <h1 className={styles.subtitle}>Who has CRUSH on you !</h1>
        
        <p className={styles.info}>
          Add your phone number, Strictly for verification purpose
          <br />
          Phone numbers will not be disclosed at all
        </p>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputContainer}>
            <div className={styles.phoneInputWrapper}>
              <span className={styles.countryCode}>+91</span>
              <input
                type="tel"
                value={phoneNumber.substring(3)}
                onChange={handlePhoneChange}
                placeholder="Enter your number"
                className={`${styles.input} ${!isValid ? styles.inputError : ''}`}
              />
            </div>
            {!isValid && (
              <p className={styles.errorText}>{errorMessage}</p>
            )}
          </div>
          
          <button 
            type="submit" 
            className={styles.button}
          >
            Send OTP
          </button>
          
          <p className={styles.termsText}>
            by registering phone number, i hereby agree and 
            accept the Terms of Services and Privacy Policy in use 
            of the IRL app.
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;