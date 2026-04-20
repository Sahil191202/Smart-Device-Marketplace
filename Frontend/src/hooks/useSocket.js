import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';
import { useAuthStore } from '../store/auth.store';
import { useNotificationStore } from '../store/notification.store';

let socketInstance = null;

export const useSocket = () => {
  const { accessToken, isAuthenticated } = useAuthStore();
  const { increment } = useNotificationStore();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
      return;
    }

    // Create socket connection
    socketInstance = io(SOCKET_URL, {
      auth: { token: `Bearer ${accessToken}` },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
    });

    // Real-time notifications
    socketInstance.on('notification:new', (notification) => {
      increment();
      // Toast notification
      import('react-hot-toast').then(({ default: toast }) => {
        toast(notification.title, {
          icon: '🔔',
          duration: 4000,
        });
      });
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    // Heartbeat every 25 seconds
    const heartbeat = setInterval(() => {
      if (socketInstance?.connected) {
        socketInstance.emit('presence:heartbeat');
      }
    }, 25000);

    return () => {
      clearInterval(heartbeat);
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
    };
  }, [isAuthenticated, accessToken]);

  return socketInstance;
};

export const getSocket = () => socketInstance;