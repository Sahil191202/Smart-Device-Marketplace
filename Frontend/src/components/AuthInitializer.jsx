import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useCartStore } from '../store/cart.store';
import { useNotificationStore } from '../store/notification.store';
import { cartApi } from '../api/cart.api';
import { notificationsApi } from '../api/notifications.api';

/**
 * Runs once on app load.
 * If user is already authenticated (from persisted store),
 * load cart count and notification count.
 */
export const AuthInitializer = () => {
  const { isAuthenticated, accessToken } = useAuthStore();
  const { setCount: setCartCount } = useCartStore();
  const { setUnreadCount } = useNotificationStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || initialized.current) return;
    initialized.current = true;

    const init = async () => {
      try {
        const [cartRes, notifRes] = await Promise.allSettled([
          cartApi.getCount(),
          notificationsApi.getUnreadCount(),
        ]);
        if (cartRes.status === 'fulfilled') {
          setCartCount(cartRes.value?.data?.data?.count || 0);
        }
        if (notifRes.status === 'fulfilled') {
          setUnreadCount(notifRes.value?.data?.data?.count || 0);
        }
      } catch { /* non-critical */ }
    };

    init();
  }, [isAuthenticated, accessToken]);

  return null; // renders nothing
};