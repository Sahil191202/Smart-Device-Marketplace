import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Package, Heart, MapPin,
  User, MessageCircle, Store, ShieldCheck,
  ChevronRight, LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { authApi } from '../../api/auth.api';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview', exact: true },
  { to: '/dashboard/orders', icon: Package, label: 'My Orders' },
  { to: '/wishlist', icon: Heart, label: 'Wishlist' },
  { to: '/dashboard/addresses', icon: MapPin, label: 'Addresses' },
  { to: '/dashboard/profile', icon: User, label: 'Profile' },
  { to: '/chat', icon: MessageCircle, label: 'Messages' },
];

const sellerItems = [
  { to: '/seller', icon: Store, label: 'Seller Dashboard' },
];

const adminItems = [
  { to: '/admin', icon: ShieldCheck, label: 'Admin Panel' },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    toast.success('Logged out');
    navigate('/');
  };

  const allNavItems = [
    ...navItems,
    ...(user?.role === 'seller' || user?.role === 'admin' ? sellerItems : []),
    ...(user?.role === 'admin' ? adminItems : []),
  ];

  return (
    <div className="min-h-screen pt-16 bg-slate-50 dark:bg-dark-950">
      <div className="container-page py-8">
        <div className="flex gap-7">

          {/* ── Sidebar ──────────────────────────────────────────────────── */}
          <aside className="w-60 flex-shrink-0 hidden md:block">
            <div className="card p-3 sticky top-24">

              {/* User info */}
              <div className="flex items-center gap-3 p-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                  {user?.avatar?.url ? (
                    <img src={user.avatar.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user?.name?.[0]?.toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    {user?.role}
                  </p>
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-700/50 mb-2" />

              {/* Nav links */}
              <nav className="space-y-0.5">
                {allNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                      transition-all duration-150 group
                      ${isActive
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }
                    `}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'}`} />
                        <span className="flex-1">{item.label}</span>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary-400" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>

              <div className="h-px bg-slate-100 dark:bg-slate-700/50 my-2" />

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </aside>

          {/* ── Main content ──────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}