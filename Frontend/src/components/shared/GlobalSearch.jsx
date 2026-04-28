import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Clock, TrendingUp,
  Package, ArrowRight, Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { productsApi } from '../../api/products.api';
import { useDebounce } from '../../hooks/useDebounce';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { formatPrice } from '../../utils/format';
import { CATEGORIES } from '../../utils/constants';

const TRENDING = ['iPhone 14', 'MacBook Pro', 'Sony WH-1000XM5', 'Samsung S24', 'iPad Pro'];

export const GlobalSearch = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useLocalStorage('recent_searches', []);

  const debouncedQuery = useDebounce(query, 300);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard shortcut to open (Cmd/Ctrl + K)
  useKeyboardShortcut('k', onClose, { meta: true });
  useKeyboardShortcut('k', onClose, { ctrl: true });

  // Search suggestions
  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['search', 'suggestions', debouncedQuery],
    queryFn: () => productsApi.list({ q: debouncedQuery, limit: 5 }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60,
  });

  const suggestions = suggestionsData?.data?.data?.products || [];

  const handleSearch = (searchQuery) => {
    if (!searchQuery.trim()) return;

    // Save to recent
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s !== searchQuery);
      return [searchQuery, ...filtered].slice(0, 5);
    });

    navigate(`/marketplace?q=${encodeURIComponent(searchQuery.trim())}`);
    onClose();
  };

  const clearRecent = () => setRecentSearches([]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      handleSearch(query);
    }
    if (e.key === 'Escape') onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center pt-16 sm:pt-24 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Search panel */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="relative w-full max-w-2xl z-10"
          >
            {/* Input */}
            <div className="card shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700/50">
                <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search for devices, brands, models..."
                  className="flex-1 text-base text-slate-900 dark:text-white bg-transparent outline-none placeholder:text-slate-400"
                />
                {suggestionsLoading && (
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
                )}
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <div className="hidden sm:flex items-center gap-1 ml-1 flex-shrink-0">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-mono">
                    ESC
                  </kbd>
                </div>
              </div>

              {/* Results / Suggestions */}
              <div className="max-h-96 overflow-y-auto">

                {/* Live search results */}
                {debouncedQuery.length >= 2 && (
                  <div className="p-3">
                    {suggestions.length === 0 && !suggestionsLoading ? (
                      <div className="text-center py-6">
                        <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          No results for "{debouncedQuery}"
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 mb-2">
                          Products
                        </p>
                        <div className="space-y-1">
                          {suggestions.map((product) => {
                            const img =
                              product.images?.find((i) => i.isPrimary)?.url ||
                              product.images?.[0]?.url;

                            return (
                              <button
                                key={product._id}
                                onClick={() => {
                                  navigate(`/products/${product.slug}`);
                                  onClose();
                                }}
                                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group"
                              >
                                <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                                  {img ? (
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="w-5 h-5 text-slate-300" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                    {product.title}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {product.brand} • {formatPrice(product.price)}
                                  </p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary-600 transition-colors flex-shrink-0" />
                              </button>
                            );
                          })}
                        </div>

                        {/* See all results */}
                        <button
                          onClick={() => handleSearch(debouncedQuery)}
                          className="w-full mt-2 p-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                        >
                          <Search className="w-4 h-4" />
                          See all results for "{debouncedQuery}"
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Empty state — show recent + trending */}
                {debouncedQuery.length < 2 && (
                  <div className="p-3 space-y-5">

                    {/* Recent searches */}
                    {recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-2 mb-2">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Recent
                          </p>
                          <button
                            onClick={clearRecent}
                            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="space-y-0.5">
                          {recentSearches.map((search) => (
                            <button
                              key={search}
                              onClick={() => { setQuery(search); handleSearch(search); }}
                              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                            >
                              <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <span className="text-sm text-slate-700 dark:text-slate-300">
                                {search}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trending */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 mb-2">
                        Trending
                      </p>
                      <div className="space-y-0.5">
                        {TRENDING.map((term) => (
                          <button
                            key={term}
                            onClick={() => handleSearch(term)}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                          >
                            <TrendingUp className="w-4 h-4 text-primary-500 flex-shrink-0" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {term}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Browse categories */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 mb-2">
                        Categories
                      </p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {CATEGORIES.slice(0, 5).map((cat) => (
                          <button
                            key={cat.value}
                            onClick={() => {
                              navigate(`/marketplace?category=${cat.value}`);
                              onClose();
                            }}
                            className="flex flex-col items-center gap-1 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <span className="text-xl">{cat.icon}</span>
                            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
                              {cat.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};