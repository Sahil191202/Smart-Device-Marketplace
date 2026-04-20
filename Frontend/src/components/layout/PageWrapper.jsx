import { motion } from 'framer-motion';

export const PageWrapper = ({ children, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -16 }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
    className={`min-h-screen pt-20 ${className}`}
  >
    {children}
  </motion.div>
);