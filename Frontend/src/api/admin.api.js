import api from './axios';

export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  getRevenue: (params) => api.get('/admin/analytics/revenue', { params }),
  getOrders: (params) => api.get('/admin/analytics/orders', { params }),
  getUsers: (params) => api.get('/admin/analytics/users', { params }),
  getProducts: () => api.get('/admin/analytics/products'),
  getMetrics: () => api.get('/admin/metrics'),
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),

  // User management
  listUsers: (params) => api.get('/admin/users', { params }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  banUser: (id, reason) => api.patch(`/admin/users/${id}/ban`, { reason }),
  unbanUser: (id) => api.patch(`/admin/users/${id}/unban`),
  changeRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }),
  forceLogout: (id) => api.post(`/admin/users/${id}/force-logout`),
  deleteUser: (id, reason) => api.delete(`/admin/users/${id}`, { data: { reason } }),

  // Product moderation
  listProducts: (params) => api.get('/admin/products', { params }),
  forceRemove: (id, reason) => api.patch(`/admin/products/${id}/remove`, { reason }),
  restoreProduct: (id) => api.patch(`/admin/products/${id}/restore`),

  // Order oversight
  listOrders: (params) => api.get('/admin/orders', { params }),
  forceTransition: (id, status, note) =>
    api.patch(`/admin/orders/${id}/transition`, { status, note }),
};