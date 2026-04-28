import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, Zap, CheckCircle, ArrowRight, AlertCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { authApi } from '../../api/auth.api';
import { Button } from '../../components/ui/Button';
import { PageWrapper } from '../../components/layout/PageWrapper';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Minimum 8 characters')
      .regex(/[A-Z]/, 'Must have uppercase letter')
      .regex(/[a-z]/, 'Must have lowercase letter')
      .regex(/[0-9]/, 'Must have a number')
      .regex(/[@$!%*?&]/, 'Must have special character'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const { mutate: resetPassword, isPending } = useMutation({
    mutationFn: (data) => authApi.resetPassword({ token, password: data.password }),
    onSuccess: () => setSuccess(true),
    onError: (err) => {
      const msg = err.response?.data?.message || 'Reset failed. Link may have expired.';
      toast.error(msg);
    },
  });

  if (!token) {
    return (
      <PageWrapper>
        <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Invalid reset link
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
              This reset link is invalid or has expired.
            </p>
            <Button onClick={() => navigate('/forgot-password')}>
              Request New Link
            </Button>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-6">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              Smart<span className="text-primary-600">Market</span>
            </span>
          </div>

          <AnimatePresence mode="wait">
            {!success ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-5">
                    <Lock className="w-7 h-7 text-primary-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Set new password
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Choose a strong password for your account.
                  </p>
                </div>

                <form
                  onSubmit={handleSubmit(resetPassword)}
                  className="space-y-5"
                >
                  {/* New password */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a strong password"
                        className={`input-base pl-10 pr-10 ${errors.password ? 'border-red-400' : ''}`}
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-red-500">{errors.password.message}</p>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Repeat new password"
                        className={`input-base pl-10 pr-10 ${errors.confirmPassword ? 'border-red-400' : ''}`}
                        {...register('confirmPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
                    )}
                  </div>

                  {/* Requirements */}
                  <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {[
                      'At least 8 characters',
                      'One uppercase letter',
                      'One number',
                      'One special character (@$!%*?&)',
                    ].map((req) => (
                      <li key={req} className="flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-slate-400" />
                        {req}
                      </li>
                    ))}
                  </ul>

                  <Button
                    type="submit"
                    fullWidth
                    size="lg"
                    loading={isPending}
                    icon={ArrowRight}
                    iconPosition="right"
                  >
                    Reset Password
                  </Button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </motion.div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  Password reset! ✓
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
                  Your password has been successfully changed. You can now sign in with your new password.
                </p>
                <Button
                  fullWidth
                  size="lg"
                  icon={ArrowRight}
                  iconPosition="right"
                  onClick={() => navigate('/login')}
                >
                  Sign In
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageWrapper>
  );
}