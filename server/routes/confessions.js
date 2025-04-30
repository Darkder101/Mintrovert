// server/routes/confessions.js
const express = require('express');
const router = express.Router();

// Simulate database with an array (in practice, use Firebase or another database)
let confessions = [];

// Get all confessions
router.get('/', (req, res) => {
  res.json({
    success: true,
    confessions: confessions
  });
});

// Create a new confession
router.post('/', (req, res) => {
  const { text } = req.body;
  
  if (!text || text.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Confession text is required'
    });
  }
  
  const newConfession = {
    id: Date.now().toString(),
    text,
    timestamp: new Date(),
    comments: []
  };
  
  confessions.unshift(newConfession); // Add to beginning of array
  
  res.status(201).json({
    success: true,
    confession: newConfession
  });
});

// Add a comment to a confession
router.post('/:confessionId/comments', (req, res) => {
  const { confessionId } = req.params;
  const { text, username } = req.body;
  
  if (!text || text.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Comment text is required'
    });
  }
  
  const confessionIndex = confessions.findIndex(c => c.id === confessionId);
  
  if (confessionIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Confession not found'
    });
  }
  
  const newComment = {
    id: Date.now().toString(),
    text,
    username: username || 'Anonymous',
    timestamp: new Date()
  };
  
  confessions[confessionIndex].comments.push(newComment);
  
  res.status(201).json({
    success: true,
    comment: newComment
  });
});

module.exports = router;