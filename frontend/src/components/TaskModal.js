import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import './TaskModal.css';

const TaskModal = ({ task, listId, boardId, boardMembers, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('todo');
  const [assignments, setAssignments] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [searchUser, setSearchUser] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
      setStatus(task.status || 'todo');
      setAssignments(task.assignments || []);
    } else {
      setTitle('');
      setDescription('');
      setDueDate('');
      setStatus('todo');
      setAssignments([]);
    }
  }, [task]);

  useEffect(() => {
    if (searchUser.length >= 2) {
      const timeoutId = setTimeout(() => {
        searchUsers();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setAvailableUsers([]);
    }
  }, [searchUser]);

  const searchUsers = async () => {
    try {
      const response = await axios.get('/users/search', {
        params: { q: searchUser },
      });
      // Filter out already assigned users
      const assignedIds = assignments.map((a) => a.id);
      setAvailableUsers(
        response.data.filter((u) => !assignedIds.includes(u.id))
      );
    } catch (error) {
      console.error('Search users error:', error);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setLoading(true);
    try {
      if (task) {
        // Update existing task
        await axios.put(`/tasks/${task.id}`, {
          title,
          description,
          due_date: dueDate || null,
          status,
        });
        toast.success('Task updated successfully');
      } else {
        // Create new task
        await axios.post('/tasks', {
          list_id: listId,
          title,
          description,
          due_date: dueDate || null,
          status,
        });
        toast.success('Task created successfully');
      }
      onSave();
      onClose();
    } catch (error) {
      toast.error(task ? 'Failed to update task' : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignUser = async (userId) => {
    if (task) {
      try {
        await axios.post(`/tasks/${task.id}/assign`, { user_id: userId });
        const user = availableUsers.find((u) => u.id === userId);
        if (user) {
          setAssignments([...assignments, user]);
          setAvailableUsers(availableUsers.filter((u) => u.id !== userId));
          setSearchUser('');
        }
        toast.success('User assigned successfully');
      } catch (error) {
        toast.error('Failed to assign user');
      }
    }
  };

  const handleUnassignUser = async (userId) => {
    if (task) {
      try {
        await axios.delete(`/tasks/${task.id}/assign/${userId}`);
        setAssignments(assignments.filter((a) => a.id !== userId));
        toast.success('User unassigned successfully');
      } catch (error) {
        toast.error('Failed to unassign user');
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-header">
          <h2>{task ? 'Edit Task' : 'Create Task'}</h2>
          <button onClick={onClose} className="btn-close">
            ×
          </button>
        </div>

        <div className="task-modal-content">
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description"
              rows="4"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {task && (
            <div className="form-group">
              <label>Assignees</label>
              <div className="assignments-list">
                {assignments.map((user) => (
                  <div key={user.id} className="assignment-item">
                    <span>
                      {user.full_name || user.username}
                    </span>
                    <button
                      onClick={() => handleUnassignUser(user.id)}
                      className="btn-remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Search users to assign..."
                className="user-search-input"
              />
              {availableUsers.length > 0 && (
                <div className="user-suggestions">
                  {availableUsers.map((user) => (
                    <div
                      key={user.id}
                      className="user-suggestion-item"
                      onClick={() => handleAssignUser(user.id)}
                    >
                      {user.full_name || user.username} ({user.email})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="task-modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Saving...' : task ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
