import api from './axios';

export const cartApi = {
  get: () => api.get('/cart'),
  getCount: () => api.get('/cart/count'),
  add: (productId) => api.post(`/cart/${productId}`),
  remove: (productId) => api.delete(`/cart/${productId}`),
  clear: () => api.delete('/cart'),
};