import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, Zap, ArrowRight } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { authApi } from '../../api/auth.api';
import { cartApi } from '../../api/cart.api';
import { notificationsApi } from '../../api/notifications.api';
import { useAuthStore } from '../../store/auth.store';
import { useCartStore } from '../../store/cart.store';
import { useNotificationStore } from '../../store/notification.store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageWrapper } from '../../components/layout/PageWrapper';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const { setAuth } = useAuthStore();
  const { setCount: setCartCount } = useCartStore();
  const { setUnreadCount } = useNotificationStore();

  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm({ resolver: zodResolver(loginSchema) });

  const { mutate: login, isPending } = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (res) => {
      const { accessToken, user } = res.data.data;
      setAuth(user, accessToken);

      // Load cart count + notification count in parallel
      try {
        const [cartRes, notifRes] = await Promise.allSettled([
          cartApi.getCount(),
          notificationsApi.getUnreadCount(),
        ]);
        if (cartRes.status === 'fulfilled') {
          setCartCount(cartRes.value.data.data.count);
        }
        if (notifRes.status === 'fulfilled') {
          setUnreadCount(notifRes.value.data.data.count);
        }
      } catch { /* non-critical */ }

      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(from, { replace: true });
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Login failed';
      const code = err.response?.data?.code;

      if (code === 'ACCOUNT_LOCKED') {
        toast.error(msg);
      } else if (code === 'EMAIL_NOT_VERIFIED') {
        toast.error('Please verify your email first');
      } else {
        // Show error on password field (generic message)
        setError('password', { message: msg });
      }
    },
  });

  const onSubmit = (data) => login(data);

  return (
    <PageWrapper>
      <div className="min-h-[calc(100vh-5rem)] flex">

        {/* Left: Form */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 mb-10"
            >
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/30">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                Smart<span className="text-primary-600">Market</span>
              </span>
            </motion.div>

            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mb-8"
            >
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Welcome back
              </h1>
              <p className="text-slate-500 dark:text-slate-400">
                Sign in to your account to continue
              </p>
            </motion.div>

            {/* Form */}
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-5"
            >
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                icon={Mail}
                error={errors.email?.message}
                autoComplete="email"
                {...register('email')}
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`input-base pl-10 pr-10 ${errors.password ? 'border-red-400 focus:!border-red-500' : ''}`}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />
                    }
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={isPending}
                icon={ArrowRight}
                iconPosition="right"
                className="mt-2"
              >
                Sign In
              </Button>
            </motion.form>

            {/* Sign up link */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8"
            >
              Don't have an account?{' '}
              <Link
                to="/register"
                className="text-primary-600 hover:text-primary-700 font-semibold"
              >
                Create one free
              </Link>
            </motion.p>
          </div>
        </div>

        {/* Right: Illustration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="hidden lg:flex flex-1 items-center justify-center gradient-hero relative overflow-hidden"
        >
          <div className="absolute inset-0">
            <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-primary-600/10 blur-3xl" />
            <div className="absolute bottom-20 left-20 w-64 h-64 rounded-full bg-blue-400/10 blur-3xl" />
          </div>

          <div className="relative text-center p-12">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, type: 'spring' }}
              className="w-24 h-24 bg-primary-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-primary-600/30"
            >
              <Zap className="w-12 h-12 text-white" />
            </motion.div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              AI-Powered Marketplace
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Get fair price predictions on every device listing. Never overpay again.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              {[
                '🤖 AI Price Check',
                '🔔 Price Drop Alerts',
                '💬 Seller Chat',
                '🔒 Secure Payments',
              ].map((feat) => (
                <motion.span
                  key={feat}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="px-4 py-2 card text-sm text-slate-600 dark:text-slate-300 shadow-sm"
                >
                  {feat}
                </motion.span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </PageWrapper>
  );
}