import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from './useSocket';

export const useChatSocket = ({ roomId, onMessage, onTyping, onRead, onMissed }) => {
  const lastSeenRef = useRef(
    localStorage.getItem(`chat:lastSeen:${roomId}`) || null
  );
  const joinedRef = useRef(false);

  // Register event listeners FIRST, then join room
  // This prevents missing the first message
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomId) return;

    const handleMessage = (data) => {
      if (data.roomId === roomId) {
        onMessage?.(data.message);
        const now = new Date().toISOString();
        localStorage.setItem(`chat:lastSeen:${roomId}`, now);
        lastSeenRef.current = now;
        socket.emit('chat:markRead', { roomId });
      }
    };

    const handleTyping = (data) => {
      if (data.roomId === roomId) onTyping?.(data);
    };

    const handleRead = (data) => {
      if (data.roomId === roomId) onRead?.(data);
    };

    const handleMissed = (data) => {
      if (data.roomId === roomId) onMissed?.(data.messages);
    };

    const handleJoined = (data) => {
      if (data.roomId === roomId) {
        joinedRef.current = true;
      }
    };

    // Register ALL listeners BEFORE emitting join
    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:read', handleRead);
    socket.on('chat:missed', handleMissed);
    socket.on('chat:joined', handleJoined);

    // NOW join room
    socket.emit('chat:join', {
      roomId,
      lastSeen: lastSeenRef.current,
    });
    socket.emit('chat:markRead', { roomId });

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:read', handleRead);
      socket.off('chat:missed', handleMissed);
      socket.off('chat:joined', handleJoined);
      socket.emit('chat:leave', { roomId });
      joinedRef.current = false;
    };
  }, [roomId]);
  // Intentionally omit callbacks from deps — use refs for stability

  const sendMessage = useCallback((content, type = 'text') => {
    const socket = getSocket();
    if (!socket || !roomId) return false;
    socket.emit('chat:send', { roomId, content, type });
    return true;
  }, [roomId]);

  const sendTyping = useCallback((isTyping) => {
    const socket = getSocket();
    if (!socket || !roomId) return;
    socket.emit('chat:typing', { roomId, isTyping });
  }, [roomId]);

  return { sendMessage, sendTyping };
};