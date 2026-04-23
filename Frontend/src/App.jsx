import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AnimatePresence } from "framer-motion";

import { Navbar } from "./components/layout/Navbar";
import { ProtectedRoute } from "./components/shared/ProtectedRoute";
import { useSocket } from "./hooks/useSocket";
import { useAuthStore } from "./store/auth.store";

// Pages (lazy loaded for performance)
import { lazy, Suspense } from "react";
import { Skeleton } from "./components/ui/Skeleton";
import DashboardLayout from "./components/layout/DashboardLayout";

const Landing = lazy(() => import("./pages/Landing"));
const Marketplace = lazy(() => import("./pages/marketplace/Marketplace"));
const ProductDetail = lazy(() => import("./pages/marketplace/ProductDetail"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const Cart = lazy(() => import("./pages/cart/Cart"));
const Checkout = lazy(() => import("./pages/checkout/Checkout"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Orders = lazy(() => import("./pages/dashboard/Orders"));
const OrderSuccess = lazy(() => import("./pages/checkout/OrderSuccess"));
const Profile = lazy(() => import("./pages/dashboard/Profile"));
const Addresses = lazy(() => import("./pages/dashboard/Addresses"));
const Wishlist = lazy(() => import("./pages/wishlist/Wishlist"));
const Chat = lazy(() => import("./pages/chat/Chat"));
const SellerDashboard = lazy(() => import("./pages/seller/SellerDashboard"));
const CreateProduct = lazy(() => import("./pages/seller/CreateProduct"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const EditProduct = lazy(() => import("./pages/seller/CreateProduct"));
const Notifications = lazy(() => import("./pages/notifications/Notifications"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen pt-20 px-4">
    <div className="max-w-7xl mx-auto space-y-4 pt-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  </div>
);

// App with socket initialization
const AppContent = () => {
  const location = useLocation();
  useSocket(); // initialize socket connection

  return (
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

          {/* Protected — any user */}
          <Route
            path="/cart"
            element={
              <ProtectedRoute>
                <Cart />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkout/success"
            element={
              <ProtectedRoute>
                <OrderSuccess />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wishlist"
            element={
              <ProtectedRoute>
                <Wishlist />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:roomId"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="profile" element={<Profile />} />
            <Route path="addresses" element={<Addresses />} />
          </Route>

          {/* Seller routes */}
          <Route
            path="/seller"
            element={
              <ProtectedRoute requiredRole="seller">
                <SellerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/create"
            element={
              <ProtectedRoute requiredRole="seller">
                <CreateProduct />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/edit/:id"
            element={
              <ProtectedRoute requiredRole="seller">
                <EditProduct />
              </ProtectedRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
};

export default function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved
      ? saved === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-white dark:bg-dark-900 transition-colors duration-300">
          <Navbar onThemeToggle={() => setIsDark(!isDark)} isDark={isDark} />
          <AppContent />
        </div>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: "12px",
            background: isDark ? "#1e293b" : "#fff",
            color: isDark ? "#f1f5f9" : "#0f172a",
            border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
            padding: "12px 16px",
            fontSize: "14px",
          },
          success: {
            iconTheme: {
              primary: "#22c55e",
              secondary: "white",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "white",
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}
