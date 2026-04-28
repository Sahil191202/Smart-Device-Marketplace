import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, ZoomIn,
  ZoomOut, Download, Maximize2,
} from 'lucide-react';

export const Lightbox = ({ images, initialIndex = 0, isOpen, onClose }) => {
  const [current, setCurrent] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setCurrent(initialIndex);
    setZoom(1);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [isOpen, current]);

  const prev = () => {
    setCurrent((p) => (p === 0 ? images.length - 1 : p - 1));
    setZoom(1);
  };

  const next = () => {
    setCurrent((p) => (p === images.length - 1 ? 0 : p + 1));
    setZoom(1);
  };

  if (!isOpen || !images?.length) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
        onClick={onClose}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-6 py-4 z-10 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-white/60 text-sm font-medium">
            {current + 1} / {images.length}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-white/60 text-xs w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main image */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden relative px-16"
          onClick={(e) => e.stopPropagation()}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={current}
              src={images[current]?.url}
              alt=""
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: zoom }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="max-h-full max-w-full object-contain select-none"
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
          </AnimatePresence>

          {/* Nav buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-4 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-4 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div
            className="flex items-center justify-center gap-2 py-4 px-6 overflow-x-auto scrollbar-hide flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => { setCurrent(i); setZoom(1); }}
                className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                  current === i
                    ? 'border-white scale-110 shadow-xl'
                    : 'border-white/20 opacity-50 hover:opacity-75'
                }`}
              >
                <img
                  src={img.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};