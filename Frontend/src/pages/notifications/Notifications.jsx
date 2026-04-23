import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Package, TrendingDown, MessageCircle,
  ShoppingBag, Info, Check, CheckCheck,
  Trash2, BellOff, Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { notificationsApi } from '../../api/notifications.api';
import { useNotificationStore } from '../../store/notification.store';
import { Button } from '../../components/ui/Button';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { formatRelativeTime } from '../../utils/format';
import { getSocket } from '../../hooks/useSocket';

// ── Notification type config ──────────────────────────────────────────────────
const TYPE_CONFIG = {
  price_drop: {
    icon: TrendingDown,
    color: 'text-green-600',
    bg: 'bg-green-100 dark:bg-green-900/30',
    label: 'Price Drop',
  },
  order_update: {
    icon: Package,
    color: 'text-blue-600',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Order Update',
  },
  new_message: {
    icon: MessageCircle,
    color: 'text-purple-600',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    label: 'New Message',
  },
  product_sold: {
    icon: ShoppingBag,
    color: 'text-orange-600',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    label: 'Product Sold',
  },
  system: {
    icon: Info,
    color: 'text-slate-600',
    bg: 'bg-slate-100 dark:bg-slate-800',
    label: 'System',
  },
};

// ── Notification item ─────────────────────────────────────────────────────────
const NotificationItem = ({ notification, onMarkRead, onDelete, marking, deleting }) => {
  const navigate = useNavigate();
  const cfg = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system;
  const isUnread = !notification.isRead;

  const handleClick = () => {
    if (isUnread) onMarkRead(notification._id);
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className={`
        flex items-start gap-4 p-4 rounded-2xl transition-all cursor-pointer
        border group
        ${isUnread
          ? 'bg-primary-50/50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-800/30'
          : 'bg-white dark:bg-dark-800 border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/60'
        }
      `}
      onClick={handleClick}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
        <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {isUnread && (
                <div className="w-2 h-2 rounded-full bg-primary-600 flex-shrink-0" />
              )}
              <p className={`text-sm font-semibold truncate ${
                isUnread
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-700 dark:text-slate-200'
              }`}>
                {notification.title}
              </p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
              {notification.body}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
              {formatRelativeTime(notification.createdAt)}
            </p>
          </div>

          {/* Actions (visible on hover) */}
          <div
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {isUnread && (
              <button
                onClick={() => onMarkRead(notification._id)}
                disabled={marking}
                title="Mark as read"
                className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
              >
                {marking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              onClick={() => onDelete(notification._id)}
              disabled={deleting}
              title="Delete"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── Main Notifications page ───────────────────────────────────────────────────
export default function Notifications() {
  const queryClient = useQueryClient();
  const { setUnreadCount, decrement, reset } = useNotificationStore();
  const [activeTab, setActiveTab] = useState('all');
  const [markingId, setMarkingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Fetch notifications
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications', activeTab],
    queryFn: () =>
      notificationsApi.get({
        limit: 50,
        unread: activeTab === 'unread' ? 'true' : undefined,
      }),
    staleTime: 0,
  });

  const notifications = data?.data?.data?.notifications || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // ── Real-time: listen for new notifications via socket ─────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNew = (notification) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification:new', handleNew);
    return () => socket.off('notification:new', handleNew);
  }, [queryClient, setUnreadCount]);

  // ── Mark as read ────────────────────────────────────────────────────────────
  const { mutate: markRead } = useMutation({
    mutationFn: (id) => notificationsApi.markAsRead(id),
    onMutate: (id) => setMarkingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      decrement();
    },
    onSettled: () => setMarkingId(null),
  });

  // ── Mark all as read ─────────────────────────────────────────────────────────
  const { mutate: markAllRead, isPending: markingAll } = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      reset();
      toast.success('All notifications marked as read');
    },
    onError: () => toast.error('Failed to mark all as read'),
  });

  // ── Delete ───────────────────────────────────────────────────────────────────
  const { mutate: deleteNotif } = useMutation({
    mutationFn: (id) => notificationsApi.delete(id),
    onMutate: (id) => setDeletingId(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notification deleted');
    },
    onError: () => toast.error('Failed to delete'),
    onSettled: () => setDeletingId(null),
  });

  // Group notifications by date
  const grouped = notifications.reduce((groups, notif) => {
    const date = new Date(notif.createdAt).toDateString();
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    const label =
      date === today ? 'Today' :
      date === yesterday ? 'Yesterday' :
      new Date(notif.createdAt).toLocaleDateString('en-IN', { month: 'long', day: 'numeric' });

    if (!groups[label]) groups[label] = [];
    groups[label].push(notif);
    return groups;
  }, {});

  return (
    <PageWrapper>
      <div className="container-page max-w-2xl py-12 pb-20">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Bell className="w-7 h-7" />
              Notifications
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-primary-600 text-white text-sm font-bold">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Stay updated on prices, orders, and messages
            </p>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              icon={CheckCheck}
              loading={markingAll}
              onClick={() => markAllRead()}
            >
              Mark all read
            </Button>
          )}
        </motion.div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-6">
          {[
            { value: 'all', label: 'All' },
            { value: 'unread', label: `Unread (${unreadCount})` },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.value
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                  : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="shimmer h-20 rounded-2xl" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-5">
              <BellOff className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {activeTab === 'unread' ? 'All caught up!' : 'No notifications yet'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              {activeTab === 'unread'
                ? "You've read all your notifications"
                : "You'll be notified about price drops, orders, and messages"
              }
            </p>
            {activeTab === 'unread' && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setActiveTab('all')}
              >
                View all notifications
              </Button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([dateLabel, items]) => (
              <div key={dateLabel}>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 px-1">
                  {dateLabel}
                </p>
                <AnimatePresence mode="popLayout">
                  <div className="space-y-2">
                    {items.map((notif) => (
                      <NotificationItem
                        key={notif._id}
                        notification={notif}
                        onMarkRead={markRead}
                        onDelete={deleteNotif}
                        marking={markingId === notif._id}
                        deleting={deletingId === notif._id}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}