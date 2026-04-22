import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Trash2, Package, ArrowRight,
  AlertTriangle, TrendingDown, TrendingUp,
  ShoppingBag, Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { cartApi } from '../../api/cart.api';
import { Button } from '../../components/ui/Button';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { useCartStore } from '../../store/cart.store';
import { formatPrice } from '../../utils/format';

// ── Cart item row ─────────────────────────────────────────────────────────────
const CartItem = ({ item, onRemove, removing }) => {
  const priceChanged = item.priceChanged;
  const priceDiff = item.currentPrice - item.price;
  const isUnavailable = !item.isAvailable;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      transition={{ duration: 0.25 }}
      className={`card p-4 transition-all ${
        isUnavailable ? 'opacity-60 border-red-200 dark:border-red-800/40' : ''
      }`}
    >
      <div className="flex gap-4">
        {/* Product image */}
        <div className="w-24 h-24 rounded-xl bg-slate-100 dark:bg-slate-800 flex-shrink-0 overflow-hidden">
          {item.primaryImageUrl ? (
            <img
              src={item.primaryImageUrl}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-slate-300" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/* Unavailable warning */}
              {isUnavailable && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-red-500">
                    {item.status === 'sold' ? 'This item has been sold' : 'No longer available'}
                  </span>
                </div>
              )}

              <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2">
                {item.title}
              </h3>

              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                  {item.condition?.replace('-', ' ')}
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {item.category}
                </span>
              </div>

              {/* Price change indicator */}
              {priceChanged && !isUnavailable && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium ${
                    priceDiff < 0 ? 'text-green-600' : 'text-orange-500'
                  }`}
                >
                  {priceDiff < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5" />
                  )}
                  Price {priceDiff < 0 ? 'dropped' : 'increased'} by{' '}
                  {formatPrice(Math.abs(priceDiff))} since you added it
                </motion.div>
              )}
            </div>

            {/* Remove button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onRemove(item.productId)}
              disabled={removing}
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0"
            >
              {removing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </motion.button>
          </div>

          {/* Price row */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${
                isUnavailable
                  ? 'text-slate-400'
                  : 'text-slate-900 dark:text-white'
              }`}>
                {formatPrice(item.currentPrice)}
              </span>
              {priceChanged && (
                <span className="text-sm text-slate-400 line-through">
                  {formatPrice(item.price)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── Order summary box ─────────────────────────────────────────────────────────
const OrderSummary = ({ cart, onCheckout, checkoutLoading }) => {
  const availableItems = (cart?.items || []).filter((i) => i.isAvailable);
  const total = availableItems.reduce((sum, i) => sum + i.currentPrice, 0);
  const hasUnavailable = cart?.hasUnavailableItems;
  const itemCount = availableItems.length;

  return (
    <div className="card p-6 space-y-4 sticky top-24">
      <h3 className="font-bold text-slate-900 dark:text-white text-lg">
        Order Summary
      </h3>

      <div className="space-y-3">
        {(cart?.items || []).map((item) => (
          <div key={item.productId} className="flex items-start justify-between gap-2 text-sm">
            <span className={`line-clamp-1 flex-1 ${
              !item.isAvailable
                ? 'text-slate-400 line-through'
                : 'text-slate-600 dark:text-slate-400'
            }`}>
              {item.title}
            </span>
            <span className={`font-medium flex-shrink-0 ${
              !item.isAvailable
                ? 'text-slate-400'
                : 'text-slate-900 dark:text-white'
            }`}>
              {item.isAvailable ? formatPrice(item.currentPrice) : 'Unavailable'}
            </span>
          </div>
        ))}
      </div>

      {hasUnavailable && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30">
          <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-700 dark:text-orange-400">
            Some items are unavailable and will be excluded from checkout.
          </p>
        </div>
      )}

      <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {formatPrice(total)}
          </span>
        </div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Platform fee
          </span>
          <span className="text-sm font-medium text-green-600">Free</span>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-slate-100 dark:border-slate-700/50">
          <span className="font-bold text-slate-900 dark:text-white">Total</span>
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            {formatPrice(total)}
          </span>
        </div>
      </div>

      <Button
        fullWidth
        size="lg"
        disabled={itemCount === 0}
        loading={checkoutLoading}
        icon={ArrowRight}
        iconPosition="right"
        onClick={onCheckout}
      >
        Proceed to Checkout
      </Button>

      <p className="text-xs text-center text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
        🔒 Secured by Razorpay
      </p>
    </div>
  );
};

// ── Main Cart page ────────────────────────────────────────────────────────────
export default function Cart() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { decrement, setCount } = useCartStore();
  const [removingId, setRemovingId] = useState(null);

  // Fetch cart
  const { data: cartData, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.get,
    refetchOnWindowFocus: true,
  });

  const cart = cartData?.data?.data?.cart;

  // Remove item
  const { mutate: removeItem } = useMutation({
    mutationFn: (productId) => cartApi.remove(productId),
    onMutate: (productId) => setRemovingId(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      decrement();
      toast.success('Item removed from cart');
    },
    onError: () => toast.error('Failed to remove item'),
    onSettled: () => setRemovingId(null),
  });

  const handleCheckout = () => {
    const availableItems = (cart?.items || []).filter((i) => i.isAvailable);
    if (availableItems.length === 0) {
      toast.error('No available items to checkout');
      return;
    }
    // For marketplace (1 product per order), take the first available item
    const item = availableItems[0];
    navigate('/checkout', { state: { productId: item.productId } });
  };

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="container-page py-12">
          <div className="shimmer h-8 w-40 rounded-xl mb-8" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="shimmer h-32 rounded-2xl" />
              ))}
            </div>
            <div className="shimmer h-80 rounded-2xl" />
          </div>
        </div>
      </PageWrapper>
    );
  }

  const isEmpty = !cart?.items?.length;

  return (
    <PageWrapper>
      <div className="container-page py-12 pb-20">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <ShoppingCart className="w-7 h-7" />
              My Cart
            </h1>
            {!isEmpty && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
              </p>
            )}
          </div>
        </div>

        {isEmpty ? (
          // ── Empty cart ──────────────────────────────────────────────────────
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
              <ShoppingBag className="w-12 h-12 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Your cart is empty
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm">
              Browse our marketplace and add items you love to your cart.
            </p>
            <Button
              size="lg"
              icon={ShoppingCart}
              onClick={() => navigate('/marketplace')}
            >
              Browse Marketplace
            </Button>
          </motion.div>
        ) : (
          // ── Cart content ────────────────────────────────────────────────────
          <div className="grid lg:grid-cols-3 gap-8">

            {/* Items list */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="popLayout">
                <div className="space-y-4">
                  {cart.items.map((item) => (
                    <CartItem
                      key={item.productId}
                      item={item}
                      onRemove={removeItem}
                      removing={removingId === item.productId}
                    />
                  ))}
                </div>
              </AnimatePresence>

              {/* Continue shopping */}
              <button
                onClick={() => navigate('/marketplace')}
                className="mt-6 text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1.5"
              >
                ← Continue Shopping
              </button>
            </div>

            {/* Order summary */}
            <div>
              <OrderSummary
                cart={cart}
                onCheckout={handleCheckout}
              />
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}