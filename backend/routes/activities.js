const express = require('express');
const { authenticate } = require('../middleware/auth');
const { pool } = require('../db/init');

const router = express.Router();

// Get activities for a board
router.get('/board/:boardId', authenticate, async (req, res) => {
  try {
    const { boardId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Check board access
    const accessCheck = await pool.query(
      `SELECT b.id FROM boards b
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE b.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)`,
      [boardId, req.user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found or access denied' });
    }

    const result = await pool.query(
      `SELECT a.*, u.username, u.full_name
       FROM activities a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.board_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [boardId, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM activities WHERE board_id = $1',
      [boardId]
    );

    res.json({
      activities: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
