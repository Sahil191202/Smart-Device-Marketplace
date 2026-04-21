import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Package, Zap, Eye } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { wishlistApi } from '../../api/wishlist.api';
import { useAuthStore } from '../../store/auth.store';
import { formatPrice, getConditionColor, getDealVerdict } from '../../utils/format';
import { truncate } from '../../utils/format';

export const ProductCard = ({ product, index = 0, showWishlistStatus = false }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const [isWishlisted, setIsWishlisted] = useState(
    product.isWishlisted || false
  );

  const primaryImage =
    product.images?.find((i) => i.isPrimary)?.url ||
    product.images?.[0]?.url;

  const dealVerdict = product.predictedPrice?.value
    ? getDealVerdict(
        Math.max(
          0,
          Math.min(
            100,
            (2 - product.price / product.predictedPrice.value) * 50
          )
        )
      )
    : null;

  // ── Wishlist toggle ───────────────────────────────────────────────────────
  const { mutate: toggleWishlist, isPending: wishlistPending } = useMutation({
    mutationFn: () =>
      isWishlisted
        ? wishlistApi.remove(product._id)
        : wishlistApi.add(product._id),
    onMutate: () => setIsWishlisted((prev) => !prev),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
    },
    onError: () => {
      setIsWishlisted((prev) => !prev); // revert
      toast.error('Failed to update wishlist');
    },
  });

  const handleWishlist = (e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error('Please login to save to wishlist');
      navigate('/login');
      return;
    }
    toggleWishlist();
  };

  const handleClick = () => navigate(`/products/${product.slug}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      whileHover={{ y: -4 }}
      onClick={handleClick}
      className="card cursor-pointer group hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-black/20 transition-all duration-300 overflow-hidden"
    >
      {/* Image container */}
      <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800/50 aspect-square">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-14 h-14 text-slate-300 dark:text-slate-600" />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileHover={{ opacity: 1, scale: 1 }}
            className="opacity-0 group-hover:opacity-100 transition-all duration-200"
          >
            <div className="bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <Eye className="w-4 h-4" />
              View Details
            </div>
          </motion.div>
        </div>

        {/* Top badges row */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
          {/* Condition badge */}
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm ${getConditionColor(product.condition)}`}>
            {product.condition === 'like-new' ? 'Like New' : 
             product.condition.charAt(0).toUpperCase() + product.condition.slice(1)}
          </span>

          {/* Wishlist button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleWishlist}
            disabled={wishlistPending}
            className="w-9 h-9 rounded-xl bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:shadow-md transition-all"
          >
            <Heart
              className={`w-4 h-4 transition-all duration-200 ${
                isWishlisted
                  ? 'fill-red-500 text-red-500'
                  : 'text-slate-400 hover:text-red-400'
              }`}
            />
          </motion.button>
        </div>

        {/* AI Deal badge */}
        {dealVerdict && (
          <div className="absolute bottom-3 left-3">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm
              ${dealVerdict.color === 'green'
                ? 'bg-green-500/90 text-white'
                : dealVerdict.color === 'yellow'
                ? 'bg-yellow-500/90 text-white'
                : dealVerdict.color === 'orange'
                ? 'bg-orange-500/90 text-white'
                : 'bg-red-500/90 text-white'
              }`}
            >
              <Zap className="w-3 h-3" />
              {dealVerdict.label}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Brand + category */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {product.brand}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {product.category}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug mb-3 line-clamp-2">
          {product.title}
        </h3>

        {/* Price row */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {formatPrice(product.price)}
            </div>
            {product.predictedPrice?.value &&
              product.predictedPrice.value !== product.price && (
                <div className="text-xs text-slate-400 line-through">
                  AI: {formatPrice(product.predictedPrice.value)}
                </div>
              )}
          </div>

          {/* Location */}
          {product.location?.city && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              📍 {product.location.city}
            </span>
          )}
        </div>

        {/* Seller info */}
        {product.sellerId && typeof product.sellerId === 'object' && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {product.sellerId.name?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {product.sellerId.name}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};