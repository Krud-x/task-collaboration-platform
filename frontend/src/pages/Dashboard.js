import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');

  useEffect(() => {
    fetchBoards();
  }, [page, search]);

  const fetchBoards = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/boards', {
        params: { page, limit: 12, search },
      });
      setBoards(response.data.boards);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.error('Failed to load boards');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/boards', {
        title: newBoardTitle,
        description: newBoardDescription,
      });
      toast.success('Board created successfully');
      setShowCreateModal(false);
      setNewBoardTitle('');
      setNewBoardDescription('');
      fetchBoards();
      navigate(`/board/${response.data.id}`);
    } catch (error) {
      toast.error('Failed to create board');
    }
  };

  const handleDeleteBoard = async (boardId) => {
    if (!window.confirm('Are you sure you want to delete this board?')) {
      return;
    }
    try {
      await axios.delete(`/boards/${boardId}`);
      toast.success('Board deleted successfully');
      fetchBoards();
    } catch (error) {
      toast.error('Failed to delete board');
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>My Boards</h1>
          <div className="header-actions">
            <button onClick={() => setShowCreateModal(true)} className="btn-create">
              + Create Board
            </button>
            <div className="user-menu">
              <span>{user?.username}</span>
              <button onClick={logout} className="btn-logout">
                Logout
              </button>
            </div>
          </div>
        </div>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search boards..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </header>

      <main className="dashboard-content">
        {loading ? (
          <div className="loading">Loading boards...</div>
        ) : boards.length === 0 ? (
          <div className="empty-state">
            <h2>No boards found</h2>
            <p>Create your first board to get started!</p>
          </div>
        ) : (
          <div className="boards-grid">
            {boards.map((board) => (
              <div
                key={board.id}
                className="board-card"
                onClick={() => navigate(`/board/${board.id}`)}
              >
                <div className="board-card-header">
                  <h3>{board.title}</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBoard(board.id);
                    }}
                    className="btn-delete"
                  >
                    ×
                  </button>
                </div>
                {board.description && <p className="board-description">{board.description}</p>}
                <div className="board-stats">
                  <span>{board.list_count || 0} lists</span>
                  <span>{board.task_count || 0} tasks</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="pagination">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>
              Page {page} of {pagination.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
            >
              Next
            </button>
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Board</h2>
            <form onSubmit={handleCreateBoard}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                  required
                  placeholder="Enter board title"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newBoardDescription}
                  onChange={(e) => setNewBoardDescription(e.target.value)}
                  placeholder="Enter board description"
                  rows="3"
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
