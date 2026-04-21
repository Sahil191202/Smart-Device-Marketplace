import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal, X, ChevronDown, Search,
  LayoutGrid, LayoutList, Loader2, Filter,
} from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { productsApi } from '../../api/products.api';
import { ProductCard } from '../../components/shared/ProductCard';
import { ProductCardSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { CATEGORIES, CONDITIONS, SORT_OPTIONS } from '../../utils/constants';
import { formatPrice } from '../../utils/format';

// ── Filter sidebar ────────────────────────────────────────────────────────────
const FilterSidebar = ({ filters, onChange, onClear, totalActive }) => {
  const [priceRange, setPriceRange] = useState({
    min: filters.minPrice || '',
    max: filters.maxPrice || '',
  });

  const handlePriceApply = () => {
    onChange('minPrice', priceRange.min || undefined);
    onChange('maxPrice', priceRange.max || undefined);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filters
          {totalActive > 0 && (
            <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">
              {totalActive}
            </span>
          )}
        </h3>
        {totalActive > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Category */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Category
        </p>
        <div className="space-y-1">
          <button
            onClick={() => onChange('category', undefined)}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
              !filters.category
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => onChange('category', cat.value)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 ${
                filters.category === cat.value
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Condition */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Condition
        </p>
        <div className="space-y-1">
          {CONDITIONS.map((cond) => (
            <button
              key={cond.value}
              onClick={() =>
                onChange(
                  'condition',
                  filters.condition === cond.value ? undefined : cond.value
                )
              }
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                filters.condition === cond.value
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {cond.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price range */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Price Range (₹)
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min"
              value={priceRange.min}
              onChange={(e) => setPriceRange((p) => ({ ...p, min: e.target.value }))}
              className="input-base text-sm py-2"
            />
            <input
              type="number"
              placeholder="Max"
              value={priceRange.max}
              onChange={(e) => setPriceRange((p) => ({ ...p, max: e.target.value }))}
              className="input-base text-sm py-2"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={handlePriceApply}
          >
            Apply Price Range
          </Button>

          {/* Quick price filters */}
          <div className="space-y-1">
            {[
              { label: 'Under ₹10,000', min: 0, max: 10000 },
              { label: '₹10,000 – ₹30,000', min: 10000, max: 30000 },
              { label: '₹30,000 – ₹60,000', min: 30000, max: 60000 },
              { label: 'Above ₹60,000', min: 60000, max: undefined },
            ].map((range) => (
              <button
                key={range.label}
                onClick={() => {
                  onChange('minPrice', range.min || undefined);
                  onChange('maxPrice', range.max);
                  setPriceRange({ min: range.min || '', max: range.max || '' });
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${
                  filters.minPrice === range.min && filters.maxPrice === range.max
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Active filter chips ───────────────────────────────────────────────────────
const FilterChips = ({ filters, onRemove }) => {
  const chips = [];

  if (filters.category) {
    const cat = CATEGORIES.find((c) => c.value === filters.category);
    chips.push({ key: 'category', label: cat?.label || filters.category });
  }
  if (filters.condition) {
    chips.push({ key: 'condition', label: filters.condition });
  }
  if (filters.minPrice || filters.maxPrice) {
    const label = filters.minPrice && filters.maxPrice
      ? `${formatPrice(filters.minPrice)} – ${formatPrice(filters.maxPrice)}`
      : filters.minPrice
      ? `Above ${formatPrice(filters.minPrice)}`
      : `Under ${formatPrice(filters.maxPrice)}`;
    chips.push({ key: 'price', label });
  }
  if (filters.q) {
    chips.push({ key: 'q', label: `"${filters.q}"` });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {chips.map((chip) => (
        <motion.div
          key={chip.key}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30 text-primary-700 dark:text-primary-400 text-xs font-medium"
        >
          {chip.label}
          <button
            onClick={() => onRemove(chip.key)}
            className="hover:text-primary-900 dark:hover:text-primary-200 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </motion.div>
      ))}
    </div>
  );
};

// ── Main Marketplace ──────────────────────────────────────────────────────────
export default function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [gridCols, setGridCols] = useState(3);
  const loaderRef = useRef(null);

  // Build filters from URL params
  const filters = {
    q: searchParams.get('q') || undefined,
    category: searchParams.get('category') || undefined,
    condition: searchParams.get('condition') || undefined,
    minPrice: searchParams.get('minPrice')
      ? Number(searchParams.get('minPrice'))
      : undefined,
    maxPrice: searchParams.get('maxPrice')
      ? Number(searchParams.get('maxPrice'))
      : undefined,
    sort: searchParams.get('sort') || 'newest',
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== 'newest'
  ).length;

  const updateFilter = useCallback(
    (key, value) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === undefined || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        next.delete('cursor'); // reset pagination
        return next;
      });
    },
    [setSearchParams]
  );

  const removeFilter = (key) => {
    if (key === 'price') {
      updateFilter('minPrice', undefined);
      updateFilter('maxPrice', undefined);
    } else {
      updateFilter(key, undefined);
    }
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  // ── Infinite query ────────────────────────────────────────────────────────
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['products', 'list', filters],
    queryFn: ({ pageParam }) =>
      productsApi.list({
        ...filters,
        limit: 12,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const meta = lastPage?.data?.meta;
      return meta?.hasNext ? meta.nextCursor : undefined;
    },
    initialPageParam: undefined,
    staleTime: 1000 * 60 * 3,
  });

  const products = data?.pages?.flatMap(
    (p) => p?.data?.data?.products || []
  ) || [];

  const totalCount = data?.pages?.[0]?.data?.data?.products?.length || 0;

  // ── Infinite scroll with IntersectionObserver ─────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const gridClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  }[gridCols];

  return (
    <PageWrapper>
      <div className="container-page pb-20">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="py-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {filters.q ? (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Search results for
                </p>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  "{filters.q}"
                </h1>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                  {filters.category
                    ? CATEGORIES.find((c) => c.value === filters.category)?.label || 'Browse'
                    : 'All Listings'}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Discover great deals on pre-owned devices
                </p>
              </>
            )}
          </motion.div>
        </div>

        {/* ── Controls row ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {/* Mobile filter toggle */}
            <Button
              variant="outline"
              size="sm"
              icon={SlidersHorizontal}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {/* Product count */}
            {!isLoading && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-slate-500 dark:text-slate-400"
              >
                {products.length > 0 ? `${products.length}+ listings` : 'No results'}
              </motion.p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={filters.sort}
                onChange={(e) => updateFilter('sort', e.target.value)}
                className="input-base py-2 pl-3 pr-8 text-sm appearance-none cursor-pointer"
                style={{ backgroundImage: 'none' }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Grid toggle */}
            <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              {[
                { cols: 3, icon: LayoutGrid },
                { cols: 4, icon: LayoutList },
              ].map(({ cols, icon: Icon }) => (
                <button
                  key={cols}
                  onClick={() => setGridCols(cols)}
                  className={`p-2 rounded-lg transition-all ${
                    gridCols === cols
                      ? 'bg-white dark:bg-dark-800 shadow-sm text-primary-600'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Active filter chips ───────────────────────────────────────────── */}
        <AnimatePresence>
          <FilterChips filters={filters} onRemove={removeFilter} />
        </AnimatePresence>

        {/* ── Main content: sidebar + grid ─────────────────────────────────── */}
        <div className="flex gap-8">

          {/* Sidebar — desktop */}
          <aside className="hidden lg:block w-60 flex-shrink-0">
            <div className="card p-5 sticky top-24">
              <FilterSidebar
                filters={filters}
                onChange={updateFilter}
                onClear={clearAllFilters}
                totalActive={activeFilterCount}
              />
            </div>
          </aside>

          {/* Mobile sidebar drawer */}
          <AnimatePresence>
            {sidebarOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSidebarOpen(false)}
                  className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                />
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  className="fixed left-0 top-0 bottom-0 w-72 card rounded-none shadow-2xl z-50 p-6 overflow-y-auto lg:hidden"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-semibold text-slate-900 dark:text-white">Filters</h2>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <FilterSidebar
                    filters={filters}
                    onChange={(key, val) => {
                      updateFilter(key, val);
                      setSidebarOpen(false);
                    }}
                    onClear={() => {
                      clearAllFilters();
                      setSidebarOpen(false);
                    }}
                    totalActive={activeFilterCount}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Product grid */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className={`grid ${gridClass} gap-5`}>
                {[...Array(12)].map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : isError ? (
              <EmptyState
                icon={Search}
                title="Something went wrong"
                description="Failed to load products. Please try again."
                action={() => window.location.reload()}
                actionLabel="Retry"
              />
            ) : products.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No listings found"
                description={
                  activeFilterCount > 0
                    ? "Try removing some filters to see more results."
                    : "No products available yet. Check back soon!"
                }
                action={activeFilterCount > 0 ? clearAllFilters : undefined}
                actionLabel={activeFilterCount > 0 ? "Clear filters" : undefined}
              />
            ) : (
              <>
                <div className={`grid ${gridClass} gap-5`}>
                  <AnimatePresence>
                    {products.map((product, i) => (
                      <ProductCard
                        key={product._id}
                        product={product}
                        index={i}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {/* Infinite scroll trigger */}
                <div ref={loaderRef} className="flex justify-center mt-8 py-4">
                  {isFetchingNextPage && (
                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Loading more...</span>
                    </div>
                  )}
                  {!hasNextPage && products.length > 0 && (
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      You've seen all {products.length} listings
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}