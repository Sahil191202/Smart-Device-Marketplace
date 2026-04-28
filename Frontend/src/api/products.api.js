import api from './axios';

export const productsApi = {
  list: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  getBySlug: (slug) => api.get(`/products/slug/${slug}`),
  create: (data) => api.post('/products/create', data),
  update: (id, data) => api.patch(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getPriceAnalysis: (id) => api.get(`/products/${id}/price-analysis`),
  getMyListings: (params) => api.get('/products/me/listings', { params }),
  addImages: (id, formData) =>
    api.post(`/products/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  removeImage: (id, imageId) => api.delete(`/products/${id}/images/${imageId}`),
  setPrimaryImage: (productId, imageId) =>
  api.patch(`/products/${productId}/images/${imageId}/primary`),
};