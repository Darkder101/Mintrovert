// src/utils/filterUtils.js

// List of sensitive keywords to filter
// This list can be expanded as needed
const sensitiveKeywords = [
    'fuck', 'shit', 'ass', 'bitch', 'bastard', 'cunt', 'dick', 'pussy', 
    'cock', 'whore', 'slut', 'damn', 'piss', 'nigger', 'faggot', 'retard',
    // Add more keywords as needed
  ];
  
  // Regular expression to match whole words only
  const createSensitiveWordsRegex = () => {
    const wordBoundary = '\\b';
    const patterns = sensitiveKeywords.map(word => 
      `${wordBoundary}${word.split('').join('\\s*')}${wordBoundary}`
    );
    return new RegExp(patterns.join('|'), 'gi');
  };
  
  // Function to filter sensitive words
  export const filterSensitiveContent = (text) => {
    if (!text) return '';
    
    // Create regex with word boundaries
    const regex = createSensitiveWordsRegex();
    
    // Replace sensitive words with asterisks
    return text.replace(regex, match => {
      // Preserve capitalization pattern
      return '*'.repeat(match.length);
    });
  };
  
  // Function to check if text contains sensitive content
  export const containsSensitiveContent = (text) => {
    if (!text) return false;
    const regex = createSensitiveWordsRegex();
    return regex.test(text);
  };