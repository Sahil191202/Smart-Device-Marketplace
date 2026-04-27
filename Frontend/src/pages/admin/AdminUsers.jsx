import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Ban, UserCheck, Shield, LogOut,
  ChevronLeft, ChevronRight, MoreVertical,
  AlertTriangle, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { formatDate } from '../../utils/format';

// ── User action modal ─────────────────────────────────────────────────────────
const UserActionModal = ({ isOpen, onClose, user, action, onConfirm, loading }) => {
  const [reason, setReason] = useState('');
  const [newRole, setNewRole] = useState(user?.role || 'user');

  const ROLES = ['user', 'seller', 'admin'];

  const config = {
    ban: {
      title: 'Ban User',
      description: `This will immediately suspend ${user?.name}'s account and invalidate all their sessions.`,
      color: 'danger',
      requiresReason: true,
      buttonLabel: 'Ban User',
    },
    unban: {
      title: 'Unban User',
      description: `This will restore ${user?.name}'s access to the platform.`,
      color: 'success',
      requiresReason: false,
      buttonLabel: 'Unban User',
    },
    role: {
      title: 'Change Role',
      description: `Change ${user?.name}'s role. This will invalidate their sessions.`,
      color: 'primary',
      requiresReason: false,
      buttonLabel: 'Update Role',
    },
    logout: {
      title: 'Force Logout',
      description: `This will terminate all active sessions for ${user?.name}.`,
      color: 'warning',
      requiresReason: false,
      buttonLabel: 'Force Logout',
    },
  };

  const cfg = config[action] || {};

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={cfg.title} size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-white font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {user?.name}
            </p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          {cfg.description}
        </p>

        {action === 'role' && (
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-2">
              New Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setNewRole(r)}
                  className={`p-2.5 rounded-xl border text-sm font-medium capitalize transition-all ${
                    newRole === r
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {cfg.requiresReason && (
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-1.5">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for this action..."
              rows={3}
              className="input-base resize-none"
            />
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={
              action === 'ban' ? 'danger' :
              action === 'unban' ? 'success' :
              'primary'
            }
            fullWidth
            loading={loading}
            disabled={cfg.requiresReason && !reason.trim()}
            onClick={() => onConfirm({ user, action, reason, newRole })}
          >
            {cfg.buttonLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ── User row ──────────────────────────────────────────────────────────────────
const UserRow = ({ user, onAction }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const roleColors = {
    admin: 'danger',
    seller: 'info',
    user: 'default',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
        {user.avatar?.url ? (
          <img src={user.avatar.url} alt="" className="w-full h-full object-cover" />
        ) : (
          user.name?.[0]?.toUpperCase()
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {user.name}
          </p>
          {user.isBanned && (
            <span className="px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 text-[10px] font-bold">
              BANNED
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {user.email}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          Joined {formatDate(user.createdAt)}
        </p>
      </div>

      {/* Role */}
      <Badge variant={roleColors[user.role] || 'default'} className="hidden sm:flex flex-shrink-0">
        {user.role}
      </Badge>

      {/* Email verified */}
      <div className="hidden md:flex flex-shrink-0">
        {user.emailVerified
          ? <CheckCircle className="w-4 h-4 text-green-500" />
          : <XCircle className="w-4 h-4 text-slate-300" />
        }
      </div>

      {/* Actions dropdown */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              className="absolute right-0 top-10 w-44 card p-1 shadow-xl z-20"
              onMouseLeave={() => setMenuOpen(false)}
            >
              {[
                {
                  label: user.isBanned ? 'Unban User' : 'Ban User',
                  action: user.isBanned ? 'unban' : 'ban',
                  icon: user.isBanned ? UserCheck : Ban,
                  color: user.isBanned ? 'text-green-600' : 'text-red-500',
                },
                { label: 'Change Role', action: 'role', icon: Shield, color: 'text-primary-600' },
                { label: 'Force Logout', action: 'logout', icon: LogOut, color: 'text-orange-500' },
              ].map((item) => (
                <button
                  key={item.action}
                  onClick={() => {
                    setMenuOpen(false);
                    onAction(user, item.action);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${item.color} hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ── Main Admin Users ──────────────────────────────────────────────────────────
export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modal, setModal] = useState({ open: false, user: null, action: null });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search, roleFilter],
    queryFn: () =>
      adminApi.listUsers({
        page,
        limit: 20,
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
      }),
    keepPreviousData: true,
  });

  const users = data?.data?.data?.users || [];
  const meta = data?.data?.data?.meta || {};

  const { mutate: executeAction, isPending: actionPending } = useMutation({
    mutationFn: ({ user, action, reason, newRole }) => {
      switch (action) {
        case 'ban': return adminApi.banUser(user._id, reason);
        case 'unban': return adminApi.unbanUser(user._id);
        case 'role': return adminApi.changeRole(user._id, newRole);
        case 'logout': return adminApi.forceLogout(user._id);
        default: throw new Error('Unknown action');
      }
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setModal({ open: false, user: null, action: null });
      const messages = {
        ban: 'User banned successfully',
        unban: 'User unbanned',
        role: 'Role updated',
        logout: 'User sessions terminated',
      };
      toast.success(messages[action] || 'Action completed');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Action failed'),
  });

  return (
    <PageWrapper>
      <div className="container-page py-8 pb-20">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              User Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {meta.total || 0} total users
            </p>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-base pl-9"
            />
          </div>
          <div className="flex gap-2">
            {['', 'user', 'seller', 'admin'].map((role) => (
              <button
                key={role}
                onClick={() => { setRoleFilter(role); setPage(1); }}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all capitalize ${
                  roleFilter === role
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {role || 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Users table */}
        <div className="card p-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="shimmer h-16 rounded-xl" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-slate-400 dark:text-slate-500 text-sm">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {users.map((user) => (
                <UserRow
                  key={user._id}
                  user={user}
                  onAction={(u, action) => setModal({ open: true, user: u, action })}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Page {page} of {meta.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={ChevronLeft}
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={ChevronRight}
                iconPosition="right"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Action modal */}
        <UserActionModal
          isOpen={modal.open}
          onClose={() => setModal({ open: false, user: null, action: null })}
          user={modal.user}
          action={modal.action}
          onConfirm={executeAction}
          loading={actionPending}
        />
      </div>
    </PageWrapper>
  );
}