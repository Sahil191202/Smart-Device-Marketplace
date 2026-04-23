import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from './useSocket';

/**
 * Hook for chat-specific socket events.
 * Handles: join room, send message, typing, read receipts, missed messages.
 */
export const useChatSocket = ({ roomId, onMessage, onTyping, onRead, onMissed }) => {
  const lastSeenRef = useRef(localStorage.getItem(`chat:lastSeen:${roomId}`) || null);

  // Join room on mount
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomId) return;

    socket.emit('chat:join', {
      roomId,
      lastSeen: lastSeenRef.current,
    });

    // Mark as read when joining
    socket.emit('chat:markRead', { roomId });

    return () => {
      socket.emit('chat:leave', { roomId });
    };
  }, [roomId]);

  // Register event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMessage = (data) => {
      if (data.roomId === roomId) {
        onMessage?.(data.message);
        // Update lastSeen
        const now = new Date().toISOString();
        localStorage.setItem(`chat:lastSeen:${roomId}`, now);
        lastSeenRef.current = now;
        // Mark as read
        socket.emit('chat:markRead', { roomId });
      }
    };

    const handleTyping = (data) => {
      if (data.roomId === roomId) {
        onTyping?.(data);
      }
    };

    const handleRead = (data) => {
      if (data.roomId === roomId) {
        onRead?.(data);
      }
    };

    const handleMissed = (data) => {
      if (data.roomId === roomId) {
        onMissed?.(data.messages);
      }
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:read', handleRead);
    socket.on('chat:missed', handleMissed);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:read', handleRead);
      socket.off('chat:missed', handleMissed);
    };
  }, [roomId, onMessage, onTyping, onRead, onMissed]);

  // Send message
  const sendMessage = useCallback((content, type = 'text') => {
    const socket = getSocket();
    if (!socket || !roomId) return false;

    socket.emit('chat:send', { roomId, content, type });
    return true;
  }, [roomId]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping) => {
    const socket = getSocket();
    if (!socket || !roomId) return;
    socket.emit('chat:typing', { roomId, isTyping });
  }, [roomId]);

  return { sendMessage, sendTyping };
};