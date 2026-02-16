const express = require('express');
const { authenticate } = require('../middleware/auth');
const { pool } = require('../db/init');
const { createActivity } = require('../utils/activity');

const router = express.Router();

// Create task
router.post('/', authenticate, async (req, res) => {
  try {
    const { list_id, title, description, position, due_date } = req.body;

    if (!list_id || !title) {
      return res.status(400).json({ error: 'List ID and title are required' });
    }

    // Check list and board access
    const accessCheck = await pool.query(
      `SELECT l.*, l.board_id FROM lists l
       JOIN boards b ON l.board_id = b.id
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE l.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)`,
      [list_id, req.user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'List not found or access denied' });
    }

    const boardId = accessCheck.rows[0].board_id;

    // Get max position if not provided
    let taskPosition = position;
    if (taskPosition === undefined) {
      const maxPosResult = await pool.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as max_pos FROM tasks WHERE list_id = $1',
        [list_id]
      );
      taskPosition = maxPosResult.rows[0].max_pos;
    }

    const result = await pool.query(
      'INSERT INTO tasks (list_id, title, description, position, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [list_id, title, description || null, taskPosition, due_date || null]
    );

    // Create activity
    await createActivity(pool, boardId, req.user.id, 'created', 'task', result.rows[0].id, {
      title: result.rows[0].title
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`board-${boardId}`).emit('task-created', { task: result.rows[0] });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { title, description, position, due_date, status, list_id } = req.body;

    // Get task with access check
    const taskCheck = await pool.query(
      `SELECT t.*, l.board_id FROM tasks t
       JOIN lists l ON t.list_id = l.id
       JOIN boards b ON l.board_id = b.id
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE t.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)`,
      [req.params.id, req.user.id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    const boardId = taskCheck.rows[0].board_id;
    const currentListId = taskCheck.rows[0].list_id;

    // If moving to different list, update list_id
    if (list_id && list_id !== currentListId) {
      // Verify new list access
      const newListCheck = await pool.query(
        `SELECT l.* FROM lists l
         JOIN boards b ON l.board_id = b.id
         LEFT JOIN board_members bm ON b.id = bm.board_id
         WHERE l.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)`,
        [list_id, req.user.id]
      );

      if (newListCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Target list not found or access denied' });
      }
    }

    const result = await pool.query(
      `UPDATE tasks SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        position = COALESCE($3, position),
        due_date = COALESCE($4, due_date),
        status = COALESCE($5, status),
        list_id = COALESCE($6, list_id),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [title, description, position, due_date, status, list_id, req.params.id]
    );

    // Create activity
    await createActivity(pool, boardId, req.user.id, 'updated', 'task', req.params.id, {
      title: result.rows[0].title,
      moved: list_id && list_id !== currentListId
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`board-${boardId}`).emit('task-updated', { task: result.rows[0] });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete task
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // Get task with access check
    const taskCheck = await pool.query(
      `SELECT t.*, l.board_id FROM tasks t
       JOIN lists l ON t.list_id = l.id
       JOIN boards b ON l.board_id = b.id
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE t.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)`,
      [req.params.id, req.user.id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    const boardId = taskCheck.rows[0].board_id;

    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);

    // Create activity
    await createActivity(pool, boardId, req.user.id, 'deleted', 'task', req.params.id, {});

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`board-${boardId}`).emit('task-deleted', { taskId: req.params.id });

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign user to task
router.post('/:id/assign', authenticate, async (req, res) => {
  try {
    const { user_id } = req.body;

    // Get task with access check
    const taskCheck = await pool.query(
      `SELECT t.*, l.board_id FROM tasks t
       JOIN lists l ON t.list_id = l.id
       JOIN boards b ON l.board_id = b.id
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE t.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)`,
      [req.params.id, req.user.id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    const boardId = taskCheck.rows[0].board_id;

    // Check if user is board member
    const memberCheck = await pool.query(
      `SELECT * FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, user_id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(400).json({ error: 'User is not a member of this board' });
    }

    // Add assignment
    await pool.query(
      'INSERT INTO task_assignments (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, user_id]
    );

    const userResult = await pool.query(
      'SELECT id, username, email, full_name FROM users WHERE id = $1',
      [user_id]
    );

    // Create activity
    await createActivity(pool, boardId, req.user.id, 'assigned', 'task', req.params.id, {
      userId: user_id,
      username: userResult.rows[0].username
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`board-${boardId}`).emit('task-assigned', {
      taskId: req.params.id,
      user: userResult.rows[0]
    });

    res.json(userResult.rows[0]);
  } catch (error) {
    console.error('Assign task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unassign user from task
router.delete('/:id/assign/:userId', authenticate, async (req, res) => {
  try {
    // Get task with access check
    const taskCheck = await pool.query(
      `SELECT t.*, l.board_id FROM tasks t
       JOIN lists l ON t.list_id = l.id
       JOIN boards b ON l.board_id = b.id
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE t.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)`,
      [req.params.id, req.user.id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    const boardId = taskCheck.rows[0].board_id;

    await pool.query(
      'DELETE FROM task_assignments WHERE task_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    );

    // Create activity
    await createActivity(pool, boardId, req.user.id, 'unassigned', 'task', req.params.id, {
      userId: req.params.userId
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`board-${boardId}`).emit('task-unassigned', {
      taskId: req.params.id,
      userId: req.params.userId
    });

    res.json({ message: 'User unassigned successfully' });
  } catch (error) {
    console.error('Unassign task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
