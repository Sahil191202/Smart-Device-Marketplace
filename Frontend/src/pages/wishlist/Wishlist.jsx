import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, TrendingDown, TrendingUp, Trash2,
  ShoppingCart, Package, Bell, ArrowRight,
  Zap,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { wishlistApi } from '../../api/wishlist.api';
import { cartApi } from '../../api/cart.api';
import { Button } from '../../components/ui/Button';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { useCartStore } from '../../store/cart.store';
import { formatPrice, formatDate, getDealVerdict } from '../../utils/format';

// ── Price drop badge ──────────────────────────────────────────────────────────
const PriceDropBadge = ({ dropPercent, dropAmount }) => {
  if (!dropPercent || dropPercent <= 0) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500 text-white text-xs font-semibold shadow-lg shadow-green-500/30"
    >
      <TrendingDown className="w-3.5 h-3.5" />
      ↓ {dropPercent}% off
    </motion.div>
  );
};

// ── Wishlist item card ────────────────────────────────────────────────────────
const WishlistCard = ({ item, onRemove, onAddToCart, removing, addingToCart }) => {
  const navigate = useNavigate();
  const { product, savedPrice, currentPrice, priceDrop, dropPercent, addedAt } = item;

  if (!product) return null;

  const primaryImage =
    product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url;

  const priceIncreased = currentPrice > savedPrice;
  const priceDropped = priceDrop > 0;
  const isAvailable = product.status === 'active';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, height: 0 }}
      className="card overflow-hidden group"
    >
      {/* Image */}
      <div
        className="relative aspect-square bg-slate-50 dark:bg-slate-800/50 cursor-pointer overflow-hidden"
        onClick={() => navigate(`/products/${product.slug}`)}
      >
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-slate-300" />
          </div>
        )}

        {/* Price drop badge */}
        <PriceDropBadge dropPercent={dropPercent} dropAmount={priceDrop} />

        {/* Unavailable overlay */}
        {!isAvailable && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <span className="text-white font-semibold text-sm px-4 py-2 rounded-xl bg-black/50">
              {product.status === 'sold' ? 'Sold Out' : 'Unavailable'}
            </span>
          </div>
        )}

        {/* Remove button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(product._id);
          }}
          disabled={removing}
          className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm flex items-center justify-center shadow-sm text-slate-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </motion.button>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide font-medium">
          {product.brand}
        </p>
        <h3
          className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug mb-3 cursor-pointer hover:text-primary-600 transition-colors"
          onClick={() => navigate(`/products/${product.slug}`)}
        >
          {product.title}
        </h3>

        {/* Price section */}
        <div className="space-y-1.5 mb-4">
          {/* Current price */}
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${
              priceDropped ? 'text-green-600' :
              priceIncreased ? 'text-orange-500' :
              'text-slate-900 dark:text-white'
            }`}>
              {formatPrice(currentPrice)}
            </span>

            {/* Change indicator */}
            {priceDropped && (
              <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <TrendingDown className="w-3.5 h-3.5" />
                ↓ {formatPrice(priceDrop)}
              </div>
            )}
            {priceIncreased && (
              <div className="flex items-center gap-1 text-xs text-orange-500 font-medium">
                <TrendingUp className="w-3.5 h-3.5" />
                ↑ {formatPrice(currentPrice - savedPrice)}
              </div>
            )}
          </div>

          {/* Saved price */}
          {(priceDropped || priceIncreased) && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Saved at: <span className="line-through">{formatPrice(savedPrice)}</span>
            </p>
          )}

          {/* Added date */}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Saved {formatDate(addedAt)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={ArrowRight}
            iconPosition="right"
            onClick={() => navigate(`/products/${product.slug}`)}
            fullWidth
          >
            View
          </Button>
          {isAvailable && (
            <Button
              size="sm"
              icon={ShoppingCart}
              loading={addingToCart}
              onClick={() => onAddToCart(product._id)}
              fullWidth
            >
              Add Cart
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ── Summary bar ───────────────────────────────────────────────────────────────
const WishlistSummary = ({ items }) => {
  const withDrops = items.filter((i) => i.priceDrop > 0);
  const totalSavings = withDrops.reduce((sum, i) => sum + i.priceDrop, 0);

  if (withDrops.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30"
    >
      <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
        <Bell className="w-5 h-5 text-green-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-green-800 dark:text-green-300">
          🎉 {withDrops.length} item{withDrops.length > 1 ? 's have' : ' has'} dropped in price!
        </p>
        <p className="text-xs text-green-700 dark:text-green-400">
          You could save {formatPrice(totalSavings)} total compared to when you saved them
        </p>
      </div>
    </motion.div>
  );
};

// ── Main Wishlist page ────────────────────────────────────────────────────────
export default function Wishlist() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { increment: incrementCart } = useCartStore();
  const [removingId, setRemovingId] = useState(null);
  const [addingToCartId, setAddingToCartId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => wishlistApi.get({ limit: 50 }),
    staleTime: 1000 * 60 * 2,
  });

  const items = data?.data?.data?.wishlist || [];

  // Remove from wishlist
  const { mutate: removeFromWishlist } = useMutation({
    mutationFn: (productId) => wishlistApi.remove(productId),
    onMutate: (productId) => setRemovingId(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast.success('Removed from wishlist');
    },
    onError: () => toast.error('Failed to remove'),
    onSettled: () => setRemovingId(null),
  });

  // Add to cart
  const { mutate: addToCart } = useMutation({
    mutationFn: (productId) => cartApi.add(productId),
    onMutate: (productId) => setAddingToCartId(productId),
    onSuccess: () => {
      incrementCart();
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Added to cart!');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to add to cart'),
    onSettled: () => setAddingToCartId(null),
  });

  return (
    <PageWrapper>
      <div className="container-page py-12 pb-20">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Heart className="w-7 h-7 text-red-500" />
              My Wishlist
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {items.length} saved item{items.length !== 1 ? 's' : ''}
            </p>
          </div>
        </motion.div>

        {/* Loading */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="shimmer aspect-square rounded-2xl" />
                <div className="shimmer h-4 w-3/4 rounded-lg" />
                <div className="shimmer h-4 w-1/2 rounded-lg" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          // Empty state
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-24 h-24 rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6">
              <Heart className="w-12 h-12 text-red-300" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Your wishlist is empty
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm">
              Save items you love and get notified when prices drop.
            </p>
            <Button
              size="lg"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => navigate('/marketplace')}
            >
              Browse Marketplace
            </Button>
          </motion.div>
        ) : (
          <>
            {/* Price drop summary */}
            <WishlistSummary items={items} />

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 mt-6">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <WishlistCard
                    key={item._id}
                    item={item}
                    onRemove={removeFromWishlist}
                    onAddToCart={addToCart}
                    removing={removingId === item.product?._id}
                    addingToCart={addingToCartId === item.product?._id}
                  />
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </PageWrapper>
  );
}