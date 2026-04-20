import { motion } from 'framer-motion';
import { Button } from './Button';

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-20 text-center"
  >
    {Icon && (
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
    )}
    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
      {title}
    </h3>
    {description && (
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
        {description}
      </p>
    )}
    {action && actionLabel && (
      <Button onClick={action}>{actionLabel}</Button>
    )}
  </motion.div>
);