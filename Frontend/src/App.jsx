import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { useSocket } from './hooks/useSocket';

// Lazy imports
const Landing = lazy(() => import('./pages/Landing'));
const Marketplace = lazy(() => import('./pages/marketplace/Marketplace'));
const ProductDetail = lazy(() => import('./pages/marketplace/ProductDetail'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const Cart = lazy(() => import('./pages/cart/Cart'));
const Checkout = lazy(() => import('./pages/checkout/Checkout'));
const OrderSuccess = lazy(() => import('./pages/checkout/OrderSuccess'));
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Orders = lazy(() => import('./pages/dashboard/Orders'));
const Profile = lazy(() => import('./pages/dashboard/Profile'));
const Addresses = lazy(() => import('./pages/dashboard/Addresses'));
const Wishlist = lazy(() => import('./pages/wishlist/Wishlist'));
const Chat = lazy(() => import('./pages/chat/Chat'));
const Notifications = lazy(() => import('./pages/notifications/Notifications'));
const SellerDashboard = lazy(() => import('./pages/seller/SellerDashboard'));
const CreateProduct = lazy(() => import('./pages/seller/CreateProduct'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Page loader
const PageLoader = () => (
  <div className="min-h-screen pt-20 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">Loading...</p>
    </div>
  </div>
);

const AppContent = () => {
  const location = useLocation();
  useSocket();

  return (
    <>
      <AnimatePresence mode="wait">
        <Suspense fallback={<PageLoader />}>
          <Routes location={location} key={location.pathname}>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/products/:slug" element={<ProductDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Protected */}
            <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
            <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
            <Route path="/checkout/success" element={<ProtectedRoute><OrderSuccess /></ProtectedRoute>} />
            <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

            {/* Chat */}
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/chat/:roomId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />

            {/* Dashboard (nested) */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<Orders />} />
              <Route path="profile" element={<Profile />} />
              <Route path="addresses" element={<Addresses />} />
            </Route>

            {/* Seller */}
            <Route path="/seller" element={<ProtectedRoute requiredRole="seller"><SellerDashboard /></ProtectedRoute>} />
            <Route path="/seller/create" element={<ProtectedRoute requiredRole="seller"><CreateProduct /></ProtectedRoute>} />
            <Route path="/seller/edit/:id" element={<ProtectedRoute requiredRole="seller"><CreateProduct /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AnimatePresence>

      {/* Mobile bottom nav */}
      <MobileNav />
    </>
  );
};

export default function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <div className="min-h-screen bg-white dark:bg-dark-900 transition-colors duration-300 pb-16 md:pb-0">
            <Navbar onThemeToggle={() => setIsDark(!isDark)} isDark={isDark} />
            <AppContent />
          </div>
        </BrowserRouter>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '12px',
              background: isDark ? '#1e293b' : '#fff',
              color: isDark ? '#f1f5f9' : '#0f172a',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              padding: '12px 16px',
              fontSize: '14px',
              boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
            },
          }}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}