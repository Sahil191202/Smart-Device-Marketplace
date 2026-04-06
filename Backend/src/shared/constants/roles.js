// src/shared/constants/roles.js
module.exports = {
  ROLES: {
    USER: 'user',
    SELLER: 'seller',
    ADMIN: 'admin',
  },

  // Which roles can access which operations
  ROLE_HIERARCHY: {
    admin: ['admin', 'seller', 'user'],
    seller: ['seller', 'user'],
    user: ['user'],
  },
};