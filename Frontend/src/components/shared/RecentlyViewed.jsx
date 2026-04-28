import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, X, ChevronRight } from 'lucide-react';
import { LazyImage } from '../ui/LazyImage';
import { useRecentlyViewed } from '../../hooks/useRecentlyViewed';
import { formatPrice, getConditionColor } from '../../utils/format';

export const RecentlyViewed = () => {
  const navigate = useNavigate();
  const { viewed, clearViewed } = useRecentlyViewed();

  if (viewed.length === 0) return null;

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-400" />
          Recently Viewed
        </h2>
        <button
          onClick={clearViewed}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {viewed.map((product, i) => (
          <motion.button
            key={product._id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -3 }}
            onClick={() => navigate(`/products/${product.slug}`)}
            className="flex-shrink-0 w-36 text-left group"
          >
            <div className="w-36 h-36 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2.5">
              {product.primaryImage ? (
                <img
                  src={product.primaryImage}
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <LazyImage
                  src={product.primaryImage}
                  alt={product.title}
                  className="group-hover:scale-105 transition-transform duration-300"
                />
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">
              {product.brand}
            </p>
            <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug mb-1">
              {product.title}
            </p>
            <p className="text-sm font-bold text-primary-600">
              {formatPrice(product.price)}
            </p>
          </motion.button>
        ))}

        {/* Browse more */}
        <button
          onClick={() => navigate('/marketplace')}
          className="flex-shrink-0 w-36 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 h-36 text-slate-400 hover:border-primary-300 hover:text-primary-600 transition-all"
        >
          <ChevronRight className="w-5 h-5" />
          <span className="text-xs font-medium">Browse more</span>
        </button>
      </div>
    </div>
  );
};