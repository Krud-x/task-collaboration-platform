import React from 'react';
import './TaskCard.css';

const TaskCard = ({ task, onClick }) => {
  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const isOverdue = (dateString) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date() && new Date(dateString).toDateString() !== new Date().toDateString();
  };

  return (
    <div className="task-card" onClick={onClick}>
      <div className="task-title">{task.title}</div>
      {task.description && (
        <div className="task-description">{task.description}</div>
      )}
      <div className="task-footer">
        {task.due_date && (
          <span
            className={`task-due-date ${
              isOverdue(task.due_date) ? 'overdue' : ''
            }`}
          >
            {formatDate(task.due_date)}
          </span>
        )}
        {task.assignments && task.assignments.length > 0 && (
          <div className="task-assignments">
            {task.assignments.slice(0, 3).map((user) => (
              <div key={user.id} className="task-assignment-avatar">
                {user.full_name
                  ? user.full_name.charAt(0).toUpperCase()
                  : user.username.charAt(0).toUpperCase()}
              </div>
            ))}
            {task.assignments.length > 3 && (
              <div className="task-assignment-more">
                +{task.assignments.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
