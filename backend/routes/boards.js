const express = require('express');
const { authenticate } = require('../middleware/auth');
const { pool } = require('../db/init');
const { createActivity } = require('../utils/activity');

const router = express.Router();

// Get all boards for user
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT DISTINCT b.*, 
        u.username as owner_username,
        COUNT(DISTINCT l.id) as list_count,
        COUNT(DISTINCT t.id) as task_count
      FROM boards b
      LEFT JOIN users u ON b.owner_id = u.id
      LEFT JOIN board_members bm ON b.id = bm.board_id
      LEFT JOIN lists l ON b.id = l.board_id
      LEFT JOIN tasks t ON l.id = t.list_id
      WHERE (b.owner_id = $1 OR bm.user_id = $1)
    `;
    const params = [req.user.id];
    
    if (search) {
      query += ` AND (b.title ILIKE $2 OR b.description ILIKE $2)`;
      params.push(`%${search}%`);
    }

    query += ` GROUP BY b.id, u.username ORDER BY b.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT b.id) as total
       FROM boards b
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE (b.owner_id = $1 OR bm.user_id = $1)${search ? ' AND (b.title ILIKE $2 OR b.description ILIKE $2)' : ''}`,
      search ? [req.user.id, `%${search}%`] : [req.user.id]
    );

    res.json({
      boards: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get boards error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single board with lists and tasks
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Check access
    const accessCheck = await pool.query(
      `SELECT b.* FROM boards b
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE b.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)`,
      [req.params.id, req.user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const board = accessCheck.rows[0];

    // Get lists with tasks
    const listsResult = await pool.query(
      `SELECT l.*, 
        COALESCE(json_agg(
          json_build_object(
            'id', t.id,
            'title', t.title,
            'description', t.description,
            'position', t.position,
            'due_date', t.due_date,
            'status', t.status,
            'created_at', t.created_at,
            'updated_at', t.updated_at
          ) ORDER BY t.position
        ) FILTER (WHERE t.id IS NOT NULL), '[]') as tasks
      FROM lists l
      LEFT JOIN tasks t ON l.id = t.list_id
      WHERE l.board_id = $1
      GROUP BY l.id
      ORDER BY l.position`,
      [req.params.id]
    );

    // Get board members
    const membersResult = await pool.query(
      `SELECT u.id, u.username, u.email, u.full_name, bm.role
       FROM board_members bm
       JOIN users u ON bm.user_id = u.id
       WHERE bm.board_id = $1`,
      [req.params.id]
    );

    // Get task assignments
    const tasks = listsResult.rows.flatMap(list => list.tasks || []);
    const taskIds = tasks.map(t => t.id);
    let assignments = {};
    if (taskIds.length > 0) {
      const assignmentsResult = await pool.query(
        `SELECT ta.task_id, u.id, u.username, u.email, u.full_name
         FROM task_assignments ta
         JOIN users u ON ta.user_id = u.id
         WHERE ta.task_id = ANY($1)`,
        [taskIds]
      );
      assignmentsResult.rows.forEach(row => {
        if (!assignments[row.task_id]) assignments[row.task_id] = [];
        assignments[row.task_id].push({
          id: row.id,
          username: row.username,
          email: row.email,
          full_name: row.full_name
        });
      });
    }

    // Add assignments to tasks
    listsResult.rows.forEach(list => {
      if (list.tasks) {
        list.tasks = list.tasks.map(task => ({
          ...task,
          assignments: assignments[task.id] || []
        }));
      }
    });

    res.json({
      ...board,
      lists: listsResult.rows,
      members: membersResult.rows
    });
  } catch (error) {
    console.error('Get board error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create board
router.post('/', authenticate, [
  express.json()
], async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await pool.query(
      'INSERT INTO boards (title, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [title, description || null, req.user.id]
    );

    // Add owner as member
    await pool.query(
      'INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)',
      [result.rows[0].id, req.user.id, 'owner']
    );

    // Create activity
    await createActivity(pool, result.rows[0].id, req.user.id, 'created', 'board', result.rows[0].id, {
      title: result.rows[0].title
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`board-${result.rows[0].id}`).emit('board-updated', { board: result.rows[0] });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create board error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update board
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { title, description } = req.body;

    // Check access
    const accessCheck = await pool.query(
      `SELECT * FROM boards WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found or access denied' });
    }

    const result = await pool.query(
      'UPDATE boards SET title = COALESCE($1, title), description = COALESCE($2, description), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [title, description, req.params.id]
    );

    // Create activity
    await createActivity(pool, req.params.id, req.user.id, 'updated', 'board', req.params.id, {
      title: result.rows[0].title
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`board-${req.params.id}`).emit('board-updated', { board: result.rows[0] });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update board error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete board
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // Check access
    const accessCheck = await pool.query(
      `SELECT * FROM boards WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found or access denied' });
    }

    await pool.query('DELETE FROM boards WHERE id = $1', [req.params.id]);

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`board-${req.params.id}`).emit('board-deleted', { boardId: req.params.id });

    res.json({ message: 'Board deleted successfully' });
  } catch (error) {
    console.error('Delete board error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add member to board
router.post('/:id/members', authenticate, async (req, res) => {
  try {
    const { userId } = req.body;

    // Check access
    const accessCheck = await pool.query(
      `SELECT * FROM boards WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found or access denied' });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add member
    await pool.query(
      'INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.params.id, userId, 'member']
    );

    const memberResult = await pool.query(
      `SELECT u.id, u.username, u.email, u.full_name, bm.role
       FROM board_members bm
       JOIN users u ON bm.user_id = u.id
       WHERE bm.board_id = $1 AND bm.user_id = $2`,
      [req.params.id, userId]
    );

    // Create activity
    await createActivity(pool, req.params.id, req.user.id, 'added_member', 'board', req.params.id, {
      userId: userId
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`board-${req.params.id}`).emit('member-added', { member: memberResult.rows[0] });

    res.json(memberResult.rows[0]);
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
