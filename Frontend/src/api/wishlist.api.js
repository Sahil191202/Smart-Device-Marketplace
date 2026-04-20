import api from './axios';

export const wishlistApi = {
  get: (params) => api.get('/wishlist', { params }),
  add: (productId) => api.post(`/wishlist/${productId}`),
  remove: (productId) => api.delete(`/wishlist/${productId}`),
  check: (productId) => api.get(`/wishlist/check/${productId}`),
  getCount: () => api.get('/wishlist/count'),
};