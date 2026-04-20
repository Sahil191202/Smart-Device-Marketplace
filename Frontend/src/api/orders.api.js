import api from './axios';

export const ordersApi = {
  checkout: (data) => api.post('/orders/checkout', data),
  verifyPayment: (data) => api.post('/orders/verify-payment', data),
  getMyOrders: (params) => api.get('/orders/my/buying', { params }),
  getSellerOrders: (params) => api.get('/orders/my/selling', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  markShipped: (id, data) => api.patch(`/orders/${id}/ship`, data),
  markDelivered: (id) => api.patch(`/orders/${id}/delivered`),
  cancel: (id, reason) => api.patch(`/orders/${id}/cancel`, { reason }),
};