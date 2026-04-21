import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { formatPrice } from '../../utils/format';

export const DealScore = ({ analysis, loading = false }) => {
  if (loading) {
    return (
      <div className="card p-5 space-y-3">
        <div className="shimmer h-5 w-40 rounded-lg" />
        <div className="shimmer h-8 w-full rounded-xl" />
        <div className="shimmer h-4 w-3/4 rounded-lg" />
      </div>
    );
  }

  if (!analysis || !analysis.predicted_price) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-500">AI Price Analysis</span>
        </div>
        <p className="text-xs text-slate-400">Analysis pending...</p>
      </div>
    );
  }

  const score = analysis.deal_score;
  const verdict = analysis.verdict;

  const getScoreColor = (s) => {
    if (s >= 70) return '#22c55e';
    if (s >= 50) return '#eab308';
    if (s >= 35) return '#f97316';
    return '#ef4444';
  };

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-primary-600" />
        </div>
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          AI Price Analysis
        </span>
        <span className="text-xs text-slate-400 ml-auto">
          {Math.round((analysis.confidence || 0) * 100)}% confidence
        </span>
      </div>

      <div className="flex items-center gap-5">
        {/* Circular score gauge */}
        <div className="relative flex-shrink-0">
          <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
            {/* Background circle */}
            <circle
              cx="44" cy="44" r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              className="text-slate-100 dark:text-slate-700"
            />
            {/* Score arc */}
            <motion.circle
              cx="44" cy="44" r="36"
              fill="none"
              stroke={color}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
            />
          </svg>
          {/* Score number */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-xl font-bold text-slate-900 dark:text-white"
            >
              {Math.round(score)}
            </motion.span>
            <span className="text-[10px] text-slate-400 font-medium">/100</span>
          </div>
        </div>

        {/* Price comparison */}
        <div className="flex-1 space-y-2.5">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Listed Price</p>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {formatPrice(analysis.listed_price)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">AI Fair Price</p>
            <p className="text-base font-semibold" style={{ color }}>
              {formatPrice(analysis.predicted_price)}
            </p>
          </div>

          {/* Verdict */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            <Zap className="w-3 h-3" />
            {verdict}
          </div>
        </div>
      </div>

      {/* Price range */}
      {analysis.price_range && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Fair price range</p>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {formatPrice(analysis.price_range.min)}
            </span>
            <div className="flex-1 mx-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, ((analysis.listed_price - analysis.price_range.min) / (analysis.price_range.max - analysis.price_range.min)) * 100))}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {formatPrice(analysis.price_range.max)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};