import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useSocket } from '../contexts/SocketContext';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import ActivitySidebar from '../components/ActivitySidebar';
import './Board.css';

const Board = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { socket, joinBoard, leaveBoard } = useSocket();
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedListId, setSelectedListId] = useState(null);
  const [showActivitySidebar, setShowActivitySidebar] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');

  useEffect(() => {
    fetchBoard();
    joinBoard(id);

    if (socket) {
      socket.on('board-updated', handleBoardUpdate);
      socket.on('board-deleted', () => {
        toast.error('Board was deleted');
        navigate('/dashboard');
      });
      socket.on('list-created', handleListCreated);
      socket.on('list-updated', handleListUpdated);
      socket.on('list-deleted', handleListDeleted);
      socket.on('task-created', handleTaskCreated);
      socket.on('task-updated', handleTaskUpdated);
      socket.on('task-deleted', handleTaskDeleted);
      socket.on('task-assigned', handleTaskAssigned);
      socket.on('task-unassigned', handleTaskUnassigned);
      socket.on('member-added', handleMemberAdded);
    }

    return () => {
      leaveBoard(id);
      if (socket) {
        socket.off('board-updated');
        socket.off('board-deleted');
        socket.off('list-created');
        socket.off('list-updated');
        socket.off('list-deleted');
        socket.off('task-created');
        socket.off('task-updated');
        socket.off('task-deleted');
        socket.off('task-assigned');
        socket.off('task-unassigned');
        socket.off('member-added');
      }
    };
  }, [id, socket]);

  const fetchBoard = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/boards/${id}`);
      setBoard(response.data);
      setLists(response.data.lists || []);
    } catch (error) {
      toast.error('Failed to load board');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleBoardUpdate = (data) => {
    if (data.board) {
      setBoard((prev) => ({ ...prev, ...data.board }));
    }
  };

  const handleListCreated = (data) => {
    if (data.list) {
      setLists((prev) => [...prev, data.list]);
    }
  };

  const handleListUpdated = (data) => {
    if (data.list) {
      setLists((prev) =>
        prev.map((list) => (list.id === data.list.id ? data.list : list))
      );
    }
  };

  const handleListDeleted = (data) => {
    if (data.listId) {
      setLists((prev) => prev.filter((list) => list.id !== data.listId));
    }
  };

  const handleTaskCreated = (data) => {
    if (data.task) {
      setLists((prev) =>
        prev.map((list) => {
          if (list.id === data.task.list_id) {
            return {
              ...list,
              tasks: [...(list.tasks || []), data.task],
            };
          }
          return list;
        })
      );
    }
  };

  const handleTaskUpdated = (data) => {
    if (data.task) {
      setLists((prev) =>
        prev.map((list) => {
          if (list.id === data.task.list_id) {
            return {
              ...list,
              tasks: (list.tasks || []).map((task) =>
                task.id === data.task.id ? { ...task, ...data.task } : task
              ),
            };
          } else if (list.tasks?.some((t) => t.id === data.task.id)) {
            // Task moved to different list
            return {
              ...list,
              tasks: (list.tasks || []).filter((t) => t.id !== data.task.id),
            };
          }
          return list;
        })
      );
      // Add to new list if moved
      if (data.task.list_id) {
        setLists((prev) =>
          prev.map((list) => {
            if (list.id === data.task.list_id && !list.tasks?.some((t) => t.id === data.task.id)) {
              return {
                ...list,
                tasks: [...(list.tasks || []), data.task],
              };
            }
            return list;
          })
        );
      }
    }
  };

  const handleTaskDeleted = (data) => {
    if (data.taskId) {
      setLists((prev) =>
        prev.map((list) => ({
          ...list,
          tasks: (list.tasks || []).filter((task) => task.id !== data.taskId),
        }))
      );
    }
  };

  const handleTaskAssigned = (data) => {
    if (data.taskId && data.user) {
      setLists((prev) =>
        prev.map((list) => ({
          ...list,
          tasks: (list.tasks || []).map((task) =>
            task.id === data.taskId
              ? {
                  ...task,
                  assignments: [...(task.assignments || []), data.user],
                }
              : task
          ),
        }))
      );
    }
  };

  const handleTaskUnassigned = (data) => {
    if (data.taskId && data.userId) {
      setLists((prev) =>
        prev.map((list) => ({
          ...list,
          tasks: (list.tasks || []).map((task) =>
            task.id === data.taskId
              ? {
                  ...task,
                  assignments: (task.assignments || []).filter(
                    (a) => a.id !== data.userId
                  ),
                }
              : task
          ),
        }))
      );
    }
  };

  const handleMemberAdded = () => {
    fetchBoard(); // Refresh to get updated members
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { draggableId, source, destination } = result;

    // Handle list reordering
    if (draggableId.startsWith('list-')) {
      const listId = parseInt(draggableId.replace('list-', ''));
      const newLists = Array.from(lists);
      const [removed] = newLists.splice(source.index, 1);
      newLists.splice(destination.index, 0, removed);

      // Update positions
      newLists.forEach((list, index) => {
        if (list.position !== index) {
          axios.put(`/lists/${list.id}`, { position: index });
        }
      });

      setLists(newLists);
      return;
    }

    // Handle task movement
    const taskId = parseInt(draggableId);
    const sourceListId = parseInt(source.droppableId);
    const destListId = parseInt(destination.droppableId);

    if (sourceListId === destListId && source.index === destination.index) {
      return;
    }

    const sourceList = lists.find((l) => l.id === sourceListId);
    const destList = lists.find((l) => l.id === destListId);
    const task = sourceList?.tasks?.find((t) => t.id === taskId);

    if (!task) return;

    // Optimistic update
    const newLists = lists.map((list) => {
      if (list.id === sourceListId) {
        return {
          ...list,
          tasks: list.tasks.filter((t) => t.id !== taskId),
        };
      }
      if (list.id === destListId) {
        const newTasks = [...(list.tasks || [])];
        newTasks.splice(destination.index, 0, { ...task, list_id: destListId });
        return { ...list, tasks: newTasks };
      }
      return list;
    });
    setLists(newLists);

    try {
      await axios.put(`/tasks/${taskId}`, {
        list_id: destListId,
        position: destination.index,
      });
    } catch (error) {
      toast.error('Failed to move task');
      fetchBoard(); // Revert on error
    }
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/lists', {
        board_id: id,
        title: newListTitle,
      });
      setNewListTitle('');
      setShowAddList(false);
      toast.success('List created successfully');
    } catch (error) {
      toast.error('Failed to create list');
    }
  };

  const handleDeleteList = async (listId) => {
    if (!window.confirm('Are you sure you want to delete this list?')) {
      return;
    }
    try {
      await axios.delete(`/lists/${listId}`);
      toast.success('List deleted successfully');
    } catch (error) {
      toast.error('Failed to delete list');
    }
  };

  const handleCreateTask = (listId) => {
    setSelectedListId(listId);
    setSelectedTask(null);
    setShowTaskModal(true);
  };

  const handleEditTask = (task) => {
    setSelectedTask(task);
    setSelectedListId(null);
    setShowTaskModal(true);
  };

  if (loading) {
    return <div className="board-loading">Loading board...</div>;
  }

  if (!board) {
    return <div className="board-loading">Board not found</div>;
  }

  return (
    <div className="board-page">
      <header className="board-header">
        <div className="board-header-left">
          <button onClick={() => navigate('/dashboard')} className="btn-back">
            ← Back
          </button>
          <div>
            <h1>{board.title}</h1>
            {board.description && <p className="board-description">{board.description}</p>}
          </div>
        </div>
        <div className="board-header-right">
          <button
            onClick={() => setShowActivitySidebar(!showActivitySidebar)}
            className="btn-activity"
          >
            Activity
          </button>
        </div>
      </header>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="board-content">
          <Droppable droppableId="lists" type="LIST" direction="horizontal">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="lists-container"
              >
                {lists.map((list, index) => (
                  <Draggable
                    key={list.id}
                    draggableId={`list-${list.id}`}
                    index={index}
                  >
                    {(provided) => (
                      <div
                        {...provided.draggableProps}
                        ref={provided.innerRef}
                        className="list-card"
                      >
                        <div
                          {...provided.dragHandleProps}
                          className="list-header"
                        >
                          <h3>{list.title}</h3>
                          <button
                            onClick={() => handleDeleteList(list.id)}
                            className="btn-delete-list"
                          >
                            ×
                          </button>
                        </div>
                        <Droppable droppableId={list.id.toString()}>
                          {(provided, snapshot) => (
                            <div
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              className={`list-content ${
                                snapshot.isDraggingOver ? 'dragging-over' : ''
                              }`}
                            >
                              {(list.tasks || []).map((task, taskIndex) => (
                                <Draggable
                                  key={task.id}
                                  draggableId={task.id.toString()}
                                  index={taskIndex}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      ref={provided.innerRef}
                                      className={`task-wrapper ${
                                        snapshot.isDragging ? 'dragging' : ''
                                      }`}
                                    >
                                      <TaskCard
                                        task={task}
                                        onClick={() => handleEditTask(task)}
                                      />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                              <button
                                onClick={() => handleCreateTask(list.id)}
                                className="btn-add-task"
                              >
                                + Add Task
                              </button>
                            </div>
                          )}
                        </Droppable>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                {showAddList ? (
                  <form onSubmit={handleCreateList} className="add-list-form">
                    <input
                      type="text"
                      value={newListTitle}
                      onChange={(e) => setNewListTitle(e.target.value)}
                      placeholder="Enter list title"
                      autoFocus
                      onBlur={() => {
                        if (!newListTitle) setShowAddList(false);
                      }}
                    />
                    <div className="add-list-actions">
                      <button type="submit" className="btn-primary">
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddList(false);
                          setNewListTitle('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowAddList(true)}
                    className="btn-add-list"
                  >
                    + Add List
                  </button>
                )}
              </div>
            )}
          </Droppable>
        </div>
      </DragDropContext>

      {showTaskModal && (
        <TaskModal
          task={selectedTask}
          listId={selectedListId}
          boardId={id}
          boardMembers={board.members || []}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedTask(null);
            setSelectedListId(null);
          }}
          onSave={() => {
            fetchBoard();
          }}
        />
      )}

      {showActivitySidebar && (
        <ActivitySidebar
          boardId={id}
          onClose={() => setShowActivitySidebar(false)}
        />
      )}
    </div>
  );
};

export default Board;
