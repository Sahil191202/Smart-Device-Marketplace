// Format currency in Indian format
export const formatPrice = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format number with commas
export const formatNumber = (num) => {
  return new Intl.NumberFormat('en-IN').format(num);
};

// Format date
export const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
};

// Format relative time (2 hours ago)
export const formatRelativeTime = (date) => {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const now = new Date();
  const then = new Date(date);
  const diffMs = then - now;
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  const diffHours = Math.round(diffMins / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffSecs) < 60) return rtf.format(diffSecs, 'second');
  if (Math.abs(diffMins) < 60) return rtf.format(diffMins, 'minute');
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  return rtf.format(diffDays, 'day');
};

// Truncate text
export const truncate = (str, length = 60) => {
  if (!str) return '';
  return str.length > length ? str.slice(0, length) + '...' : str;
};

// Get condition color
export const getConditionColor = (condition) => {
  const colors = {
    new: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'like-new': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    good: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    fair: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    poor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return colors[condition] || colors.good;
};

// Get deal score color
export const getDealScoreColor = (score) => {
  if (score >= 70) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-red-500';
};

// Get deal verdict
export const getDealVerdict = (score) => {
  if (score >= 75) return { label: 'Great Deal', color: 'green' };
  if (score >= 55) return { label: 'Fair Price', color: 'yellow' };
  if (score >= 35) return { label: 'Slightly High', color: 'orange' };
  return { label: 'Overpriced', color: 'red' };
};