const express = require('express');
const { authenticate } = require('../middleware/auth');
const { pool } = require('../db/init');

const router = express.Router();

// Search users
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT id, username, email, full_name FROM users 
       WHERE username ILIKE $1 OR email ILIKE $1 OR full_name ILIKE $1
       LIMIT 10`,
      [`%${q}%`]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
