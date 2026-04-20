import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

export const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    const roleHierarchy = {
      admin: ['admin'],
      seller: ['seller', 'admin'],
      user: ['user', 'seller', 'admin'],
    };

    if (!roleHierarchy[requiredRole]?.includes(user?.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};