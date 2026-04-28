import { useEffect } from 'react';

/**
 * Register keyboard shortcuts.
 * Example: useKeyboardShortcut('k', handleSearch, { meta: true })
 *
 * @param {string} key
 * @param {Function} callback
 * @param {Object} options — { meta, ctrl, shift, alt }
 */
export const useKeyboardShortcut = (key, callback, options = {}) => {
  useEffect(() => {
    const handler = (e) => {
      const { meta = false, ctrl = false, shift = false, alt = false } = options;

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        e.metaKey === meta &&
        e.ctrlKey === ctrl &&
        e.shiftKey === shift &&
        e.altKey === alt &&
        !e.target.matches('input, textarea, select')
      ) {
        e.preventDefault();
        callback(e);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, options]);
};