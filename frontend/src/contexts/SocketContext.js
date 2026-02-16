import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const newSocket = io(WS_URL, {
        transports: ['websocket'],
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    } else {
      if (socket) {
        socket.close();
        setSocket(null);
      }
    }
  }, [user]);

  const joinBoard = (boardId) => {
    if (socket) {
      socket.emit('join-board', boardId);
    }
  };

  const leaveBoard = (boardId) => {
    if (socket) {
      socket.emit('leave-board', boardId);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, joinBoard, leaveBoard }}>
      {children}
    </SocketContext.Provider>
  );
};
