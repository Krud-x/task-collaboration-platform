const express = require('express');
const { authenticate } = require('../middleware/auth');
const { pool } = require('../db/init');
const { createActivity } = require('../utils/activity');

const router = express.Router();

// Create list
router.post('/', authenticate, async (req, res) => {
  try {
    const { board_id, title, position } = req.body;

    if (!board_id || !title) {
      return res.status(400).json({ error: 'Board ID and title are required' });
    }

    // Check board access
    const accessCheck = await pool.query(
      `SELECT b.id FROM boards b
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE b.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)`,
      [board_id, req.user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found or access denied' });
    }

    // Get max position if not provided
    let listPosition = position;
    if (listPosition === undefined) {
      const maxPosResult = await pool.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as max_pos FROM lists WHERE board_id = $1',
        [board_id]
      );
      listPosition = maxPosResult.rows[0].max_pos;
    }

    const result = await pool.query(
      'INSERT INTO lists (board_id, title, position) VALUES ($1, $2, $3) RETURNING *',
      [board_id, title, listPosition]
    );

    // Create activity
    await createActivity(pool, board_id, req.user.id, 'created', 'list', result.rows[0].id, {
      title: result.rows[0].title
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`board-${board_id}`).emit('list-created', { list: result.rows[0] });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update list
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { title, position } = req.body;

    // Get list with board access check
    const listCheck = await pool.query(
      `SELECT l.* FROM lists l
       JOIN boards b ON l.board_id = b.id
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE l.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)`,
      [req.params.id, req.user.id]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'List not found or access denied' });
    }

    const boardId = listCheck.rows[0].board_id;

    const result = await pool.query(
      'UPDATE lists SET title = COALESCE($1, title), position = COALESCE($2, position), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [title, position, req.params.id]
    );

    // Create activity
    await createActivity(pool, boardId, req.user.id, 'updated', 'list', req.params.id, {
      title: result.rows[0].title
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`board-${boardId}`).emit('list-updated', { list: result.rows[0] });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete list
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // Get list with board access check
    const listCheck = await pool.query(
      `SELECT l.* FROM lists l
       JOIN boards b ON l.board_id = b.id
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE l.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)`,
      [req.params.id, req.user.id]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'List not found or access denied' });
    }

    const boardId = listCheck.rows[0].board_id;

    await pool.query('DELETE FROM lists WHERE id = $1', [req.params.id]);

    // Create activity
    await createActivity(pool, boardId, req.user.id, 'deleted', 'list', req.params.id, {});

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`board-${boardId}`).emit('list-deleted', { listId: req.params.id });

    res.json({ message: 'List deleted successfully' });
  } catch (error) {
    console.error('Delete list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
