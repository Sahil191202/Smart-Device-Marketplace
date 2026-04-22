import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, Heart, ShoppingBag, ArrowRight,
  Clock, CheckCircle, Truck, AlertCircle,
  Zap, TrendingUp,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { ordersApi } from '../../api/orders.api';
import { wishlistApi } from '../../api/wishlist.api';
import { useAuthStore } from '../../store/auth.store';
import { formatPrice, formatRelativeTime, formatDate } from '../../utils/format';
import { Button } from '../../components/ui/Button';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Pending' },
  confirmed: { icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Confirmed' },
  shipped: { icon: Truck, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'Shipped' },
  delivered: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Delivered' },
  cancelled: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Cancelled' },
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color, onClick, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    whileHover={{ y: -2 }}
    onClick={onClick}
    className={`card p-5 ${onClick ? 'cursor-pointer hover:shadow-lg transition-all duration-300' : ''}`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{label}</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{value}</p>
        {sub && <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    {onClick && (
      <div className="flex items-center gap-1 mt-3 text-xs font-medium text-primary-600">
        View all <ArrowRight className="w-3.5 h-3.5" />
      </div>
    )}
  </motion.div>
);

// ── Order status badge ────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <cfg.icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'recent'],
    queryFn: () => ordersApi.getMyOrders({ limit: 5 }),
  });

  const { data: wishlistData } = useQuery({
    queryKey: ['wishlist', 'count'],
    queryFn: wishlistApi.getCount,
  });

  const orders = ordersData?.data?.data?.orders || [];
  const wishlistCount = wishlistData?.data?.data?.count || 0;
  const totalSpent = orders
    .filter((o) => ['confirmed', 'shipped', 'delivered'].includes(o.status))
    .reduce((sum, o) => sum + o.amount, 0);

  const activeOrders = orders.filter((o) =>
    ['pending', 'confirmed', 'shipped'].includes(o.status)
  ).length;

  return (
    <div className="space-y-8">

      {/* Welcome header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Here's what's happening with your account
        </p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Package}
          label="Total Orders"
          value={orders.length}
          sub={`${activeOrders} active`}
          color="bg-primary-600"
          onClick={() => navigate('/dashboard/orders')}
          delay={0}
        />
        <StatCard
          icon={Heart}
          label="Wishlist"
          value={wishlistCount}
          sub="saved items"
          color="bg-red-500"
          onClick={() => navigate('/wishlist')}
          delay={0.05}
        />
        <StatCard
          icon={TrendingUp}
          label="Total Spent"
          value={formatPrice(totalSpent)}
          sub="lifetime"
          color="bg-green-500"
          delay={0.1}
        />
        <StatCard
          icon={ShoppingBag}
          label="Delivered"
          value={orders.filter((o) => o.status === 'delivered').length}
          sub="items received"
          color="bg-purple-500"
          delay={0.15}
        />
      </div>

      {/* Recent orders */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-slate-900 dark:text-white text-lg">
            Recent Orders
          </h2>
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowRight}
            iconPosition="right"
            onClick={() => navigate('/dashboard/orders')}
          >
            View all
          </Button>
        </div>

        {ordersLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="shimmer h-20 rounded-xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-10">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
              No orders yet
            </p>
            <Button
              size="sm"
              onClick={() => navigate('/marketplace')}
            >
              Start Shopping
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <motion.div
                key={order._id}
                whileHover={{ x: 2 }}
                onClick={() => navigate('/dashboard/orders')}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
              >
                {/* Product image */}
                <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                  {order.productSnapshot?.primaryImageUrl ? (
                    <img
                      src={order.productSnapshot.primaryImageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {order.productSnapshot?.title || 'Product'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {formatDate(order.createdAt)}
                  </p>
                </div>

                {/* Amount + status */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                    {formatPrice(order.amount)}
                  </p>
                  <StatusBadge status={order.status} />
                </div>

                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="grid grid-cols-2 gap-4"
      >
        {[
          {
            icon: ShoppingBag,
            title: 'Browse Marketplace',
            desc: 'Find great deals',
            color: 'bg-primary-50 dark:bg-primary-900/20',
            iconColor: 'text-primary-600',
            action: () => navigate('/marketplace'),
          },
          {
            icon: Zap,
            title: 'Sell a Device',
            desc: 'List your gadget',
            color: 'bg-green-50 dark:bg-green-900/20',
            iconColor: 'text-green-600',
            action: () => navigate('/seller/create'),
          },
        ].map((item) => (
          <motion.button
            key={item.title}
            whileTap={{ scale: 0.98 }}
            onClick={item.action}
            className={`${item.color} rounded-2xl p-5 text-left hover:shadow-md transition-all duration-200`}
          >
            <item.icon className={`w-7 h-7 ${item.iconColor} mb-3`} />
            <p className="font-semibold text-slate-900 dark:text-white text-sm">
              {item.title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {item.desc}
            </p>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}