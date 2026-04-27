import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home, Search, Heart, ShoppingCart, User,
} from 'lucide-react';
import { useCartStore } from '../../store/cart.store';
import { useNotificationStore } from '../../store/notification.store';
import { useAuthStore } from '../../store/auth.store';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', exact: true },
  { to: '/marketplace', icon: Search, label: 'Browse' },
  { to: '/wishlist', icon: Heart, label: 'Wishlist', auth: true },
  { to: '/cart', icon: ShoppingCart, label: 'Cart', auth: true },
  { to: '/dashboard', icon: User, label: 'Account', auth: true },
];

export const MobileNav = () => {
  const { count: cartCount } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.auth || isAuthenticated
  );

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-slate-100 dark:border-slate-700/50 pb-safe">
      <div className="flex items-center justify-around px-2 py-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) => `
              flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl
              transition-all duration-150 relative
              ${isActive
                ? 'text-primary-600'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }
            `}
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : ''}`} />

                  {/* Cart badge */}
                  {item.to === '/cart' && cartCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                    >
                      {cartCount > 9 ? '9+' : cartCount}
                    </motion.span>
                  )}
                </div>

                <span className={`text-[10px] font-medium ${isActive ? 'text-primary-600' : ''}`}>
                  {item.label}
                </span>

                {/* Active indicator dot */}
                {isActive && (
                  <motion.div
                    layoutId="mobileNavIndicator"
                    className="absolute -bottom-2 w-1 h-1 rounded-full bg-primary-600"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};