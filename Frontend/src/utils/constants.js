export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const CATEGORIES = [
  { value: 'smartphones', label: 'Smartphones', icon: '📱' },
  { value: 'laptops', label: 'Laptops', icon: '💻' },
  { value: 'tablets', label: 'Tablets', icon: '📟' },
  { value: 'smartwatches', label: 'Smartwatches', icon: '⌚' },
  { value: 'headphones', label: 'Headphones', icon: '🎧' },
  { value: 'cameras', label: 'Cameras', icon: '📷' },
  { value: 'gaming', label: 'Gaming', icon: '🎮' },
  { value: 'accessories', label: 'Accessories', icon: '🔌' },
  { value: 'networking', label: 'Networking', icon: '🌐' },
  { value: 'other', label: 'Other', icon: '📦' },
];

export const CONDITIONS = [
  { value: 'new', label: 'New', color: 'green' },
  { value: 'like-new', label: 'Like New', color: 'blue' },
  { value: 'good', label: 'Good', color: 'yellow' },
  { value: 'fair', label: 'Fair', color: 'orange' },
  { value: 'poor', label: 'Poor', color: 'red' },
];

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'most_viewed', label: 'Most Popular' },
];