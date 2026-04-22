import api from './axios';

export const usersApi = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data) => api.patch('/users/me', data),
  uploadAvatar: (formData) =>
    api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteAvatar: () => api.delete('/users/me/avatar'),
  getAddresses: () => api.get('/users/me/addresses'),
  addAddress: (data) => api.post('/users/me/addresses', data),
  updateAddress: (id, data) => api.patch(`/users/me/addresses/${id}`, data),
  deleteAddress: (id) => api.delete(`/users/me/addresses/${id}`),
  setDefaultAddress: (id) => api.patch(`/users/me/addresses/${id}/default`),
};