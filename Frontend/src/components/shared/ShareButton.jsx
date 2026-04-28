import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2, Copy, Check, MessageCircle,
  Link,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FaTwitter } from "react-icons/fa"

export const ShareButton = ({ title, price, url }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = url || window.location.href;
  const shareText = `Check out ${title} for ${price} on SmartMarketplace!`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: shareUrl });
      } catch { /* user cancelled */ }
    } else {
      setOpen(!open);
    }
  };

  const shareOptions = [
    {
      label: 'Copy link',
      icon: copied ? Check : Copy,
      action: copyLink,
      color: 'text-slate-600 dark:text-slate-300',
    },
    {
      label: 'WhatsApp',
      icon: MessageCircle,
      action: () =>
        window.open(
          `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`,
          '_blank'
        ),
      color: 'text-green-600',
    },
    {
      label: 'Twitter',
      icon: FaTwitter,
      action: () =>
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
          '_blank'
        ),
      color: 'text-sky-500',
    },
  ];

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={shareNative}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
      >
        <Share2 className="w-4 h-4" />
        Share
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            className="absolute right-0 top-12 w-44 card p-1.5 shadow-xl z-20"
          >
            {shareOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={() => { opt.action(); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium ${opt.color} hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors`}
              >
                <opt.icon className="w-4 h-4" />
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};