import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package } from 'lucide-react';

/**
 * Lazy-loaded image with blur placeholder + IntersectionObserver.
 * Prevents images below the fold from loading until visible.
 */
export const LazyImage = ({
  src,
  alt = '',
  className = '',
  placeholderClassName = '',
  fallback = null,
  aspectRatio = 'aspect-square',
  objectFit = 'object-cover',
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  if (error || !src) {
    return (
      <div
        ref={imgRef}
        className={`bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${aspectRatio} ${placeholderClassName}`}
      >
        {fallback || <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />}
      </div>
    );
  }

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${aspectRatio}`}>
      {/* Shimmer placeholder */}
      <AnimatePresence>
        {!loaded && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 shimmer ${placeholderClassName}`}
          />
        )}
      </AnimatePresence>

      {/* Actual image */}
      {inView && (
        <motion.img
          src={src}
          alt={alt}
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className={`w-full h-full ${objectFit} ${className}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
};