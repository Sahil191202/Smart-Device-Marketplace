import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, ChevronLeft, ChevronRight,
  ArrowRight, Clock, CheckCircle, Truck,
  AlertCircle, RotateCcw, Zap,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { formatPrice, formatDate } from '../../utils/format';

const STATUS_CONFIG = {
  pending:   { icon: Clock,       color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30',  label: 'Pending',   variant: 'warning' },
  confirmed: { icon: CheckCircle, color: 'text-blue-500',   bg: 'bg-blue-100 dark:bg-blue-900/30',      label: 'Confirmed', variant: 'info'    },
  shipped:   { icon: Truck,       color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30',  label: 'Shipped',   variant: 'default' },
  delivered: { icon: CheckCircle, color: 'text-green-500',  bg: 'bg-green-100 dark:bg-green-900/30',    label: 'Delivered', variant: 'success' },
  cancelled: { icon: AlertCircle, color: 'text-red-500',    bg: 'bg-red-100 dark:bg-red-900/30',        label: 'Cancelled', variant: 'danger'  },
  refunded:  { icon: RotateCcw,   color: 'text-slate-500',  bg: 'bg-slate-100 dark:bg-slate-800',       label: 'Refunded',  variant: 'default' },
};

const ALLOWED_NEXT = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped:   ['delivered'],
  cancelled: ['refunded'],
};

// ── Order detail modal ────────────────────────────────────────────────────────
const OrderDetailModal = ({ isOpen, onClose, order, onTransition, transitioning }) => {
  const [nextStatus, setNextStatus] = useState('');
  const [note, setNote] = useState('');
  const cfg = STATUS_CONFIG[order?.status] || STATUS_CONFIG.pending;
  const allowed = ALLOWED_NEXT[order?.status] || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Order Details" size="lg">
      {!order ? null : (
        <div className="space-y-5">
          {/* Product */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
              {order.productSnapshot?.primaryImageUrl ? (
                <img src={order.productSnapshot.primaryImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-7 h-7 text-slate-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2">
                {order.productSnapshot?.title}
              </p>
              <p className="text-lg font-bold text-primary-600 mt-1">
                {formatPrice(order.amount)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                  <cfg.icon className="w-3 h-3" />
                  {cfg.label}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(order.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Buyer
              </p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {typeof order.buyerId === 'object' ? order.buyerId.name : 'N/A'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Seller
              </p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {typeof order.sellerId === 'object' ? order.sellerId.name : 'N/A'}
              </p>
            </div>
          </div>

          {/* Delivery address */}
          {order.deliveryAddress && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Delivery Address
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {order.deliveryAddress.line1}, {order.deliveryAddress.city}, {order.deliveryAddress.state} — {order.deliveryAddress.pincode}
              </p>
            </div>
          )}

          {/* Timeline */}
          {order.timeline?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Timeline
              </p>
              <div className="space-y-2">
                {[...order.timeline].reverse().map((event, i) => {
                  const evCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.pending;
                  return (
                    <div key={i} className="flex items-start gap-2.5 text-xs">
                      <div className={`w-6 h-6 rounded-full ${evCfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <evCfg.icon className={`w-3 h-3 ${evCfg.color}`} />
                      </div>
                      <div>
                        <span className="font-medium text-slate-900 dark:text-white capitalize">{event.status}</span>
                        {event.note && (
                          <span className="text-slate-500 dark:text-slate-400 ml-2">— {event.note}</span>
                        )}
                        <p className="text-slate-400 dark:text-slate-500 mt-0.5">{formatDate(event.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Force transition */}
          {allowed.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4 space-y-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary-600" />
                Force Status Transition
              </p>

              <div className="flex gap-2 flex-wrap">
                {allowed.map((s) => {
                  const sCfg = STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setNextStatus(nextStatus === s ? '' : s)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-all ${
                        nextStatus === s
                          ? `${sCfg.bg} ${sCfg.color} border-current`
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <ArrowRight className="w-3 h-3" />
                      {s}
                    </button>
                  );
                })}
              </div>

              {nextStatus && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2"
                >
                  <input
                    placeholder="Admin note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="input-base text-sm"
                  />
                  <Button
                    fullWidth
                    loading={transitioning}
                    onClick={() => onTransition(order._id, nextStatus, note)}
                    icon={Zap}
                  >
                    Force to "{nextStatus}"
                  </Button>
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

// ── Main Admin Orders ─────────────────────────────────────────────────────────
export default function AdminOrders() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', page, statusFilter],
    queryFn: () =>
      adminApi.listOrders({
        limit: 20,
        cursor: undefined,
        ...(statusFilter && { status: statusFilter }),
      }),
    keepPreviousData: true,
  });

  const orders = data?.data?.data?.orders || [];

  const { mutate: forceTransition, isPending: transitioning } = useMutation({
    mutationFn: ({ orderId, status, note }) =>
      adminApi.forceTransition(orderId, status, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      setSelectedOrder(null);
      toast.success('Order status updated');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Transition failed'),
  });

  const STATUS_FILTERS = ['', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

  return (
    <PageWrapper>
      <div className="container-page py-8 pb-20">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Order Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {orders.length} orders shown
          </p>
        </motion.div>

        {/* Status filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
          {STATUS_FILTERS.map((s) => {
            const cfg = s ? STATUS_CONFIG[s] : null;
            return (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap border transition-all flex-shrink-0 ${
                  statusFilter === s
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {cfg && <cfg.icon className="w-3.5 h-3.5" />}
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All Orders'}
              </button>
            );
          })}
        </div>

        {/* Orders table */}
        <div className="card p-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="shimmer h-20 rounded-xl" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No orders found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {orders.map((order) => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                return (
                  <motion.div
                    key={order._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setSelectedOrder(order)}
                    className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    {/* Product image */}
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                      {order.productSnapshot?.primaryImageUrl ? (
                        <img src={order.productSnapshot.primaryImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {order.productSnapshot?.title || 'Product'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        <span>#{order._id?.slice(-8).toUpperCase()}</span>
                        <span>•</span>
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {formatPrice(order.amount)}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="flex-shrink-0 hidden md:flex">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                        <cfg.icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Page {page}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={ChevronLeft}
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={ChevronRight}
              iconPosition="right"
              disabled={orders.length < 20}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>

        {/* Order detail modal */}
        <OrderDetailModal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          order={selectedOrder}
          onTransition={(orderId, status, note) =>
            forceTransition({ orderId, status, note })
          }
          transitioning={transitioning}
        />
      </div>
    </PageWrapper>
  );
}