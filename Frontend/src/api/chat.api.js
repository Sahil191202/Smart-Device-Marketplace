import api from './axios';

export const chatApi = {
  getRooms: (params) => api.get('/chat/rooms', { params }),
  createRoom: (productId) => api.post('/chat/rooms', { productId }),
  getRoom: (roomId) => api.get(`/chat/rooms/${roomId}`),
  getMessages: (roomId, params) =>
    api.get(`/chat/rooms/${roomId}/messages`, { params }),
  markAsRead: (roomId) => api.patch(`/chat/rooms/${roomId}/read`),
  getPresence: (userId) => api.get(`/chat/presence/${userId}`),
};