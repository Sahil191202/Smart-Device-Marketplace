import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white dark:bg-dark-900">
      <div className="text-center max-w-md">
        {/* 404 number */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="relative mb-8"
        >
          <div className="text-[120px] font-black text-slate-100 dark:text-slate-800 leading-none select-none">
            404
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Search className="w-10 h-10 text-primary-600" />
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            Page not found
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
            Let's get you back on track.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              icon={Home}
              onClick={() => navigate('/')}
            >
              Go Home
            </Button>
            <Button
              size="lg"
              variant="outline"
              icon={ArrowLeft}
              onClick={() => navigate(-1)}
            >
              Go Back
            </Button>
          </div>
        </motion.div>

        {/* Floating dots decoration */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary-300 dark:bg-primary-700"
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
            }}
            animate={{
              y: [0, -10, 0],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>
    </div>
  );
}