import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ActivitySidebar.css';

const ActivitySidebar = ({ boardId, onClose }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  useEffect(() => {
    fetchActivities();
  }, [boardId, page]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/activities/board/${boardId}`, {
        params: { page, limit: 20 },
      });
      if (page === 1) {
        setActivities(response.data.activities);
      } else {
        setActivities((prev) => [...prev, ...response.data.activities]);
      }
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="activity-sidebar-overlay" onClick={onClose}>
      <div className="activity-sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="activity-sidebar-header">
          <h2>Activity</h2>
          <button onClick={onClose} className="btn-close">
            ×
          </button>
        </div>
        <div className="activity-sidebar-content">
          {loading && activities.length === 0 ? (
            <div className="loading">Loading activities...</div>
          ) : activities.length === 0 ? (
            <div className="empty-state">No activities yet</div>
          ) : (
            <div className="activities-list">
              {activities.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-content">
                    <strong>{activity.username || 'Unknown user'}</strong>{' '}
                    {activity.description}
                  </div>
                  <div className="activity-time">
                    {formatDate(activity.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && pagination.pages > page && (
            <button
              onClick={() => setPage((p) => p + 1)}
              className="btn-load-more"
            >
              Load More
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivitySidebar;
