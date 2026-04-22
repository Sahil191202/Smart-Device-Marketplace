import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Clock, CheckCircle, Truck,
  AlertCircle, ChevronDown, ChevronUp,
  X, MapPin, CreditCard, RotateCcw,
  MessageCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { ordersApi } from '../../api/orders.api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatPrice, formatDate, formatRelativeTime } from '../../utils/format';

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Pending Payment', step: 0 },
  confirmed: { icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Order Confirmed', step: 1 },
  shipped: { icon: Truck, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'Shipped', step: 2 },
  delivered: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Delivered', step: 3 },
  cancelled: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Cancelled', step: -1 },
  refunded: { icon: RotateCcw, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800', label: 'Refunded', step: -1 },
};

const FILTER_TABS = [
  { value: '', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ── Timeline ──────────────────────────────────────────────────────────────────
const OrderTimeline = ({ timeline }) => {
  if (!timeline?.length) return null;

  return (
    <div className="space-y-3">
      {[...timeline].reverse().map((event, i) => {
        const cfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.pending;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                <cfg.icon className={`w-3.5 h-3.5 ${cfg.color}`} />
              </div>
              {i < timeline.length - 1 && (
                <div className="w-0.5 h-full bg-slate-100 dark:bg-slate-700 mt-1" />
              )}
            </div>
            <div className="pb-4">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {cfg.label}
              </p>
              {event.note && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {event.note}
                </p>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {formatRelativeTime(event.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Progress bar ──────────────────────────────────────────────────────────────
const OrderProgress = ({ status }) => {
  const steps = ['confirmed', 'shipped', 'delivered'];
  const currentStep = STATUS_CONFIG[status]?.step ?? -1;

  if (status === 'cancelled' || status === 'refunded' || status === 'pending') {
    return null;
  }

  return (
    <div className="flex items-center gap-0 mt-4">
      {steps.map((step, i) => {
        const cfg = STATUS_CONFIG[step];
        const done = currentStep > i;
        const active = currentStep === i + 1;

        return (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                done || active
                  ? 'bg-primary-600 shadow-md shadow-primary-600/30'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}>
                <cfg.icon className={`w-4 h-4 ${done || active ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <span className={`text-[10px] mt-1 font-medium ${
                done || active
                  ? 'text-primary-600'
                  : 'text-slate-400'
              }`}>
                {cfg.label.split(' ')[0]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 transition-all duration-500 ${
                done ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Order card ────────────────────────────────────────────────────────────────
const OrderCard = ({ order, onCancel }) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;

  const canCancel = ['pending', 'confirmed'].includes(order.status);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden"
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Product image */}
          <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
            {order.productSnapshot?.primaryImageUrl ? (
              <img
                src={order.productSnapshot.primaryImageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-7 h-7 text-slate-300" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1">
                  {order.productSnapshot?.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Order #{order._id?.slice(-8).toUpperCase()}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {formatDate(order.createdAt)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-slate-900 dark:text-white mb-1.5">
                  {formatPrice(order.amount)}
                </p>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                  <cfg.icon className="w-3 h-3" />
                  {cfg.label}
                </span>
              </div>
            </div>

            {/* Progress */}
            <OrderProgress status={order.status} />
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center gap-2">
            {/* Mark delivered */}
            {order.status === 'shipped' && (
              <Button
                size="xs"
                variant="success"
                onClick={() => onCancel(order, 'deliver')}
              >
                Mark Delivered
              </Button>
            )}

            {/* Cancel */}
            {canCancel && (
              <Button
                size="xs"
                variant="outline"
                className="!text-red-500 !border-red-200 hover:!bg-red-50 dark:hover:!bg-red-900/20"
                onClick={() => onCancel(order, 'cancel')}
              >
                Cancel
              </Button>
            )}

            {/* Chat with seller */}
            <Button
              size="xs"
              variant="ghost"
              icon={MessageCircle}
              onClick={() => navigate('/chat')}
            >
              Chat
            </Button>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            {expanded ? 'Less' : 'Details'}
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700/50 pt-5 grid sm:grid-cols-2 gap-6">

              {/* Delivery address */}
              {order.deliveryAddress && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Delivery Address
                  </p>
                  <div className="text-sm text-slate-700 dark:text-slate-300 space-y-0.5">
                    <p>{order.deliveryAddress.line1}</p>
                    {order.deliveryAddress.line2 && <p>{order.deliveryAddress.line2}</p>}
                    <p>{order.deliveryAddress.city}, {order.deliveryAddress.state}</p>
                    <p>{order.deliveryAddress.pincode}</p>
                  </div>
                </div>
              )}

              {/* Payment info */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Payment
                </p>
                <div className="text-sm text-slate-700 dark:text-slate-300 space-y-0.5">
                  <p>Amount: <span className="font-semibold">{formatPrice(order.amount)}</span></p>
                  {order.razorpayPaymentId && (
                    <p className="font-mono text-xs text-slate-500">{order.razorpayPaymentId}</p>
                  )}
                  {order.tracking?.trackingNumber && (
                    <p>Tracking: <span className="font-medium">{order.tracking.trackingNumber}</span></p>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Order Timeline
                </p>
                <OrderTimeline timeline={order.timeline} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Cancel / Deliver modal ────────────────────────────────────────────────────
const ActionModal = ({ isOpen, onClose, order, action, onConfirm, loading }) => {
  const [reason, setReason] = useState('');

  const isCancel = action === 'cancel';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCancel ? 'Cancel Order' : 'Confirm Delivery'}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {isCancel
            ? 'Are you sure you want to cancel this order? This cannot be undone.'
            : 'Confirm that you have received the item in the described condition.'
          }
        </p>

        {isCancel && (
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-1.5">
              Reason for cancellation
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason..."
              rows={3}
              className="input-base resize-none"
            />
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" fullWidth onClick={onClose}>
            Back
          </Button>
          <Button
            variant={isCancel ? 'danger' : 'success'}
            fullWidth
            loading={loading}
            disabled={isCancel && !reason.trim()}
            onClick={() => onConfirm(order, reason)}
          >
            {isCancel ? 'Cancel Order' : 'Confirm Received'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ── Main Orders page ──────────────────────────────────────────────────────────
export default function Orders() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('');
  const [actionModal, setActionModal] = useState({ open: false, order: null, action: null });

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'buyer', activeTab],
    queryFn: () => ordersApi.getMyOrders({
      limit: 20,
      ...(activeTab && { status: activeTab }),
    }),
  });

  const orders = data?.data?.data?.orders || [];

  const { mutate: cancelOrder, isPending: cancelling } = useMutation({
    mutationFn: ({ order, reason }) => ordersApi.cancel(order._id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setActionModal({ open: false, order: null, action: null });
      toast.success('Order cancelled');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to cancel'),
  });

  const { mutate: markDelivered, isPending: delivering } = useMutation({
    mutationFn: ({ order }) => ordersApi.markDelivered(order._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setActionModal({ open: false, order: null, action: null });
      toast.success('Order marked as delivered!');
    },
    onError: () => toast.error('Failed to update order'),
  });

  const handleAction = (order, action) => {
    setActionModal({ open: true, order, action });
  };

  const handleConfirm = (order, reason) => {
    if (actionModal.action === 'cancel') {
      cancelOrder({ order, reason });
    } else {
      markDelivered({ order });
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          My Orders
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {orders.length} order{orders.length !== 1 ? 's' : ''} found
        </p>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              activeTab === tab.value
                ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="shimmer h-36 rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders found"
          description={
            activeTab
              ? `No ${activeTab} orders`
              : "You haven't placed any orders yet"
          }
          action={() => setActiveTab('')}
          actionLabel={activeTab ? 'View all orders' : undefined}
        />
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard
                key={order._id}
                order={order}
                onCancel={handleAction}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Action modal */}
      <ActionModal
        isOpen={actionModal.open}
        onClose={() => setActionModal({ open: false, order: null, action: null })}
        order={actionModal.order}
        action={actionModal.action}
        onConfirm={handleConfirm}
        loading={cancelling || delivering}
      />
    </div>
  );
}