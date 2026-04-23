import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, ArrowLeft, Package, MoreVertical,
  Check, CheckCheck, Circle, Search,
  MessageCircle, Loader2, X, Phone,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { chatApi } from '../../api/chat.api';
import { useAuthStore } from '../../store/auth.store';
import { useChatSocket } from '../../hooks/useChatSocket';
import { formatRelativeTime, formatDate, truncate } from '../../utils/format';
import { PageWrapper } from '../../components/layout/PageWrapper';

// ── Typing indicator ──────────────────────────────────────────────────────────
const TypingIndicator = () => (
  <div className="flex items-end gap-2 px-4 py-1">
    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
    <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-sm bg-white dark:bg-dark-800 border border-slate-100 dark:border-slate-700 shadow-sm">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500"
          animate={{ y: [0, -5, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  </div>
);

// ── Message bubble ────────────────────────────────────────────────────────────
const MessageBubble = ({ message, isMine, showAvatar, senderName, isRead }) => {
  const isSystem = message.type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-slate-400 dark:text-slate-500 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-end gap-2 px-4 py-0.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      {!isMine && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mb-1">
          {showAvatar ? (
            typeof message.senderId === 'object'
              ? message.senderId.name?.[0]?.toUpperCase()
              : '?'
          ) : (
            <span className="opacity-0">_</span>
          )}
        </div>
      )}

      <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Sender name (for groups / first message in sequence) */}
        {!isMine && showAvatar && (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">
            {typeof message.senderId === 'object' ? message.senderId.name : senderName}
          </span>
        )}

        {/* Bubble */}
        <div className={`
          px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words
          ${isMine
            ? 'bg-primary-600 text-white rounded-br-sm shadow-md shadow-primary-600/20'
            : 'bg-white dark:bg-dark-800 text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-bl-sm shadow-sm'
          }
        `}>
          {message.type === 'image' && message.media?.url ? (
            <img
              src={message.media.url}
              alt="Shared image"
              className="max-w-full rounded-lg"
              style={{ maxHeight: 200 }}
            />
          ) : (
            message.content
          )}
        </div>

        {/* Timestamp + read receipt */}
        <div className={`flex items-center gap-1 px-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {formatRelativeTime(message.createdAt)}
          </span>
          {isMine && (
            <div className="text-slate-400">
              {isRead
                ? <CheckCheck className="w-3.5 h-3.5 text-primary-500" />
                : <Check className="w-3.5 h-3.5" />
              }
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ── Date separator ────────────────────────────────────────────────────────────
const DateSeparator = ({ date }) => (
  <div className="flex items-center gap-3 px-4 py-2">
    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700" />
    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
      {formatDate(date)}
    </span>
    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700" />
  </div>
);

// ── Room list item ────────────────────────────────────────────────────────────
const RoomListItem = ({ room, isActive, onClick, currentUserId }) => {
  const otherParticipant = room.participants?.find(
    (p) => p._id !== currentUserId
  );

  const unread = room.unreadCounts
    ? (room.unreadCounts[currentUserId] || 0)
    : 0;

  return (
    <motion.button
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`
        w-full text-left p-4 transition-all duration-150 flex items-start gap-3
        ${isActive
          ? 'bg-primary-50 dark:bg-primary-900/20 border-r-2 border-primary-500'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }
      `}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
          {otherParticipant?.avatar?.url ? (
            <img
              src={otherParticipant.avatar.url}
              alt=""
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            otherParticipant?.name?.[0]?.toUpperCase() || '?'
          )}
        </div>
        {/* Online indicator placeholder */}
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-white dark:border-dark-900" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {otherParticipant?.name || 'Unknown'}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0 mt-0.5">
            {room.lastMessage?.sentAt
              ? formatRelativeTime(room.lastMessage.sentAt)
              : ''
            }
          </span>
        </div>

        {/* Product context */}
        {room.productId && (
          <p className="text-[10px] text-primary-600 dark:text-primary-400 truncate mt-0.5 font-medium">
            Re: {typeof room.productId === 'object' ? room.productId.title : ''}
          </p>
        )}

        {/* Last message */}
        <p className={`text-xs mt-0.5 truncate ${
          unread > 0
            ? 'text-slate-700 dark:text-slate-200 font-medium'
            : 'text-slate-500 dark:text-slate-400'
        }`}>
          {room.lastMessage?.content
            ? truncate(room.lastMessage.content, 40)
            : 'No messages yet'
          }
        </p>
      </div>

      {/* Unread badge */}
      {unread > 0 && (
        <div className="w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-1">
          {unread > 9 ? '9+' : unread}
        </div>
      )}
    </motion.button>
  );
};

// ── Conversation panel ────────────────────────────────────────────────────────
const ConversationPanel = ({ roomId, onBack }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [readMessageIds, setReadMessageIds] = useState(new Set());
  const typingTimeoutRef = useRef(null);

  // Fetch room details
  const { data: roomData } = useQuery({
    queryKey: ['chat', 'room', roomId],
    queryFn: () => chatApi.getRoom(roomId),
    enabled: !!roomId,
  });

  const room = roomData?.data?.data?.room;
  const otherParticipant = room?.participants?.find(
    (p) => p._id !== user?.id
  );
  const product = room?.productId;

  // Fetch message history
  const { data: historyData, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat', 'messages', roomId],
    queryFn: () => chatApi.getMessages(roomId, { limit: 50 }),
    enabled: !!roomId,
    onSuccess: (res) => {
      const history = res?.data?.data?.messages || [];
      setMessages(history);
    },
  });

  // ── Socket handlers ─────────────────────────────────────────────────────────
  const handleNewMessage = useCallback((msg) => {
    setMessages((prev) => {
      // Prevent duplicate messages
      if (prev.some((m) => m._id === msg._id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const handleTyping = useCallback(({ userId, isTyping }) => {
    if (userId === user?.id) return;
    setTypingUsers((prev) => {
      const next = new Set(prev);
      if (isTyping) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }, [user?.id]);

  const handleRead = useCallback(({ messageIds }) => {
    setReadMessageIds((prev) => {
      const next = new Set(prev);
      messageIds?.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const handleMissed = useCallback((missedMessages) => {
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m._id));
      const newOnes = missedMessages.filter((m) => !existingIds.has(m._id));
      return [...prev, ...newOnes];
    });
  }, []);

  const { sendMessage, sendTyping } = useChatSocket({
    roomId,
    onMessage: handleNewMessage,
    onTyping: handleTyping,
    onRead: handleRead,
    onMissed: handleMissed,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Handle typing indicator with debounce
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    sendTyping(true);

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 2000);
  };

  // Send message
  const handleSend = () => {
    const content = inputValue.trim();
    if (!content) return;

    // Optimistic update
    const tempMsg = {
      _id: `temp_${Date.now()}`,
      roomId,
      senderId: { _id: user?.id, name: user?.name },
      content,
      type: 'text',
      readBy: [{ userId: user?.id }],
      createdAt: new Date().toISOString(),
      isTemp: true,
    };

    setMessages((prev) => [...prev, tempMsg]);
    setInputValue('');
    sendTyping(false);

    // Send via socket (server will broadcast back with real _id)
    const sent = sendMessage(content);
    if (!sent) {
      toast.error('Connection lost. Please refresh.');
      setMessages((prev) => prev.filter((m) => m._id !== tempMsg._id));
    }

    // Refocus textarea
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date for separators
  const groupedMessages = messages.reduce((groups, msg, i) => {
    const date = new Date(msg.createdAt).toDateString();
    const prevDate = i > 0 ? new Date(messages[i - 1].createdAt).toDateString() : null;

    if (date !== prevDate) {
      groups.push({ type: 'date', date: msg.createdAt, key: `date_${i}` });
    }

    const prevMsg = messages[i - 1];
    const isMine = (typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId) === user?.id;
    const prevIsMine = prevMsg
      ? (typeof prevMsg.senderId === 'object' ? prevMsg.senderId._id : prevMsg.senderId) === user?.id
      : null;
    const showAvatar = !isMine && prevIsMine !== false;

    groups.push({ type: 'message', msg, isMine, showAvatar, key: msg._id });
    return groups;
  }, []);

  if (!roomId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Select a conversation
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Choose from your existing chats
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-dark-800 flex-shrink-0">
        {/* Back button (mobile) */}
        <button
          onClick={onBack}
          className="md:hidden p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Avatar */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
            {otherParticipant?.avatar?.url ? (
              <img
                src={otherParticipant.avatar.url}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              otherParticipant?.name?.[0]?.toUpperCase() || '?'
            )}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white dark:border-dark-800" />
        </div>

        {/* Name + product context */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
            {otherParticipant?.name || 'Chat'}
          </p>
          {product && (
            <p className="text-xs text-primary-600 dark:text-primary-400 truncate font-medium">
              Re: {typeof product === 'object' ? product.title : ''}
            </p>
          )}
        </div>

        {/* Product thumbnail */}
        {product && typeof product === 'object' && product.images?.[0]?.url && (
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 flex-shrink-0">
            <img
              src={product.images[0].url}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* ── Messages area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1 bg-slate-50/50 dark:bg-dark-950/50">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-primary-600" />
            </div>
            <p className="font-semibold text-slate-900 dark:text-white mb-1">
              Start the conversation
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
              {otherParticipant?.name
                ? `Say hello to ${otherParticipant.name}!`
                : 'Send a message to get started'
              }
            </p>
          </div>
        ) : (
          <>
            {groupedMessages.map((item) => {
              if (item.type === 'date') {
                return <DateSeparator key={item.key} date={item.date} />;
              }

              return (
                <MessageBubble
                  key={item.key}
                  message={item.msg}
                  isMine={item.isMine}
                  showAvatar={item.showAvatar}
                  senderName={otherParticipant?.name}
                  isRead={readMessageIds.has(item.msg._id)}
                />
              );
            })}

            {/* Typing indicator */}
            <AnimatePresence>
              {typingUsers.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <TypingIndicator />
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ── Input area ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-white dark:bg-dark-800 flex-shrink-0">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full input-base resize-none py-3 pr-4 max-h-32 overflow-y-auto leading-relaxed"
              style={{ minHeight: 44 }}
            />
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className={`
              w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
              transition-all duration-200 shadow-md
              ${inputValue.trim()
                ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-600/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 shadow-none'
              }
            `}
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>

        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 ml-1">
          Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

// ── Main Chat page ────────────────────────────────────────────────────────────
export default function Chat() {
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeRoomId, setActiveRoomId] = useState(urlRoomId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  // Fetch rooms
  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['chat', 'rooms'],
    queryFn: () => chatApi.getRooms({ limit: 50 }),
    refetchInterval: 30000, // refresh room list every 30s
  });

  const rooms = roomsData?.data?.data?.rooms || [];

  const filteredRooms = rooms.filter((room) => {
    if (!searchQuery) return true;
    const other = room.participants?.find((p) => p._id !== user?.id);
    return (
      other?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (typeof room.productId === 'object' &&
        room.productId?.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleRoomSelect = (roomId) => {
    setActiveRoomId(roomId);
    navigate(`/chat/${roomId}`, { replace: true });
    // On mobile, hide sidebar to show conversation
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const handleBack = () => {
    setShowSidebar(true);
    setActiveRoomId(null);
  };

  return (
    <PageWrapper>
      <div className="container-page py-0 px-0 sm:py-6 sm:px-4 lg:px-8">
        <div
          className="flex h-[calc(100vh-4rem)] sm:h-[calc(100vh-8rem)] rounded-none sm:rounded-2xl overflow-hidden card sm:shadow-xl"
        >

          {/* ── Room list sidebar ──────────────────────────────────────────── */}
          <div className={`
            w-full md:w-80 flex-shrink-0 border-r border-slate-100 dark:border-slate-700/50
            flex flex-col bg-white dark:bg-dark-800
            ${!showSidebar ? 'hidden md:flex' : 'flex'}
          `}>

            {/* Sidebar header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900 dark:text-white text-lg">
                  Messages
                </h2>
                <div className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
                  {rooms.length}
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-base pl-9 py-2 text-sm"
                />
              </div>
            </div>

            {/* Room list */}
            <div className="flex-1 overflow-y-auto">
              {roomsLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="shimmer w-11 h-11 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="shimmer h-4 w-3/4 rounded-lg" />
                        <div className="shimmer h-3 w-1/2 rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <MessageCircle className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {searchQuery ? 'No conversations found' : 'No conversations yet'}
                  </p>
                  {!searchQuery && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      Start chatting from a product page
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  {filteredRooms.map((room) => (
                    <RoomListItem
                      key={room.roomId}
                      room={room}
                      isActive={activeRoomId === room.roomId}
                      onClick={() => handleRoomSelect(room.roomId)}
                      currentUserId={user?.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Conversation panel ────────────────────────────────────────── */}
          <div className={`
            flex-1 flex flex-col
            ${showSidebar && !activeRoomId ? 'hidden md:flex' : 'flex'}
          `}>
            <ConversationPanel
              roomId={activeRoomId}
              onBack={handleBack}
            />
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}