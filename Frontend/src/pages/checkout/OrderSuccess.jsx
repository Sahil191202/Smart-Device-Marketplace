import { useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle, Package, ArrowRight,
  ShoppingBag, MessageCircle, Home,
} from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { formatPrice, formatDate } from '../../utils/format';

// ── Animated checkmark SVG ────────────────────────────────────────────────────
const AnimatedCheck = () => (
  <div className="relative w-28 h-28 mx-auto mb-8">
    {/* Ripple rings */}
    {[...Array(3)].map((_, i) => (
      <motion.div
        key={i}
        initial={{ scale: 0.8, opacity: 0.6 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{
          duration: 1.5,
          delay: i * 0.4,
          repeat: Infinity,
          ease: 'easeOut',
        }}
        className="absolute inset-0 rounded-full bg-green-400"
      />
    ))}

    {/* Check circle */}
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
      className="absolute inset-0 rounded-full bg-green-500 flex items-center justify-center shadow-2xl shadow-green-500/30"
    >
      <motion.div
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <CheckCircle className="w-14 h-14 text-white" strokeWidth={2} />
      </motion.div>
    </motion.div>
  </div>
);

// ── Confetti dots ─────────────────────────────────────────────────────────────
const Confetti = () => {
  const dots = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    color: ['bg-blue-400', 'bg-green-400', 'bg-yellow-400', 'bg-pink-400', 'bg-purple-400'][
      Math.floor(Math.random() * 5)
    ],
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {dots.map((dot) => (
        <motion.div
          key={dot.id}
          initial={{ y: -20, x: `${dot.x}vw`, opacity: 1 }}
          animate={{ y: '110vh', opacity: 0 }}
          transition={{
            duration: 2 + Math.random() * 2,
            delay: dot.delay,
            ease: 'easeIn',
          }}
          className={`absolute w-2.5 h-2.5 rounded-full ${dot.color}`}
          style={{ left: `${dot.x}%` }}
        />
      ))}
    </div>
  );
};

// ── Main Order Success page ───────────────────────────────────────────────────
export default function OrderSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const order = location.state?.order;

  // Redirect if accessed directly without order
  useEffect(() => {
    if (!order) {
      navigate('/', { replace: true });
    }
  }, [order, navigate]);

  if (!order) return null;

  return (
    <PageWrapper>
      <div className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center px-6 py-12 overflow-hidden">
        <Confetti />

        <div className="w-full max-w-lg relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            {/* Animated checkmark */}
            <AnimatedCheck />

            {/* Success message */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
                Payment Successful! 🎉
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mb-8">
                Your order has been confirmed. The seller will ship your item shortly.
              </p>
            </motion.div>

            {/* Order details card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="card p-6 text-left mb-6"
            >
              <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100 dark:border-slate-700/50">
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Order Confirmed
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ID: {order._id?.slice(-8).toUpperCase()}
                  </p>
                </div>
                <div className="ml-auto">
                  <span className="px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                    ✓ Confirmed
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {/* Product */}
                {order.productSnapshot && (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {order.productSnapshot.primaryImageUrl && (
                        <img
                          src={order.productSnapshot.primaryImageUrl}
                          alt=""
                          className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-slate-100"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
                          {order.productSnapshot.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
                          {order.productSnapshot.condition} • {order.productSnapshot.brand}
                        </p>
                      </div>
                    </div>
                    <span className="text-base font-bold text-slate-900 dark:text-white flex-shrink-0">
                      {formatPrice(order.amount)}
                    </span>
                  </div>
                )}

                <div className="border-t border-slate-100 dark:border-slate-700/50 pt-3 space-y-2">
                  {/* Delivery address */}
                  {order.deliveryAddress && (
                    <div className="flex items-start justify-between gap-2 text-sm">
                      <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">
                        Delivering to
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 text-right">
                        {order.deliveryAddress.city}, {order.deliveryAddress.state}
                      </span>
                    </div>
                  )}

                  {/* Amount paid */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Amount paid</span>
                    <span className="font-bold text-green-600 text-base">
                      {formatPrice(order.amount)}
                    </span>
                  </div>

                  {/* Payment method */}
                  {order.razorpayPaymentId && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Payment ID</span>
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {order.razorpayPaymentId.slice(-12)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* What happens next */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="card p-5 mb-6 text-left"
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                What happens next?
              </h3>
              <div className="space-y-3">
                {[
                  {
                    icon: '📬',
                    title: 'Seller notified',
                    desc: 'The seller has been notified about your order',
                    done: true,
                  },
                  {
                    icon: '📦',
                    title: 'Item shipped',
                    desc: 'Seller will ship within 2-3 business days',
                    done: false,
                  },
                  {
                    icon: '🏠',
                    title: 'Delivered to you',
                    desc: 'Mark as delivered once you receive the item',
                    done: false,
                  },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{step.icon}</span>
                    <div>
                      <p className={`text-sm font-medium ${
                        step.done
                          ? 'text-green-600'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {step.title}
                        {step.done && ' ✓'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="grid grid-cols-2 gap-3 mb-4"
            >
              <Button
                variant="outline"
                size="lg"
                icon={Package}
                onClick={() => navigate('/dashboard/orders')}
              >
                View Order
              </Button>
              <Button
                size="lg"
                icon={MessageCircle}
                onClick={() => navigate('/chat')}
              >
                Chat Seller
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <button
                onClick={() => navigate('/marketplace')}
                className="flex items-center justify-center gap-2 w-full text-sm text-slate-500 hover:text-primary-600 transition-colors font-medium"
              >
                <ShoppingBag className="w-4 h-4" />
                Continue Shopping
              </button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </PageWrapper>
  );
}