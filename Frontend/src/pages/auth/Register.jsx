import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, Mail, Lock, User, Zap,
  ShoppingBag, Store, Check, ArrowRight,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { authApi } from '../../api/auth.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageWrapper } from '../../components/layout/PageWrapper';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[@$!%*?&]/, 'Must contain special character (@$!%*?&)'),
  role: z.enum(['user', 'seller']),
});

// Password strength calculator
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[@$!%*?&]/.test(password)) score++;

  const levels = [
    { label: 'Very Weak', color: 'bg-red-500' },
    { label: 'Weak', color: 'bg-orange-500' },
    { label: 'Fair', color: 'bg-yellow-500' },
    { label: 'Good', color: 'bg-blue-500' },
    { label: 'Strong', color: 'bg-green-500' },
    { label: 'Very Strong', color: 'bg-green-600' },
  ];
  return { score, ...levels[score] };
};

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [role, setRole] = useState('user');
  const [registered, setRegistered] = useState(false);

  const strength = getPasswordStrength(passwordValue);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    setError,
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'user' },
  });

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setValue('role', newRole);
  };

  const { mutate: doRegister, isPending } = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      setRegistered(true);
    },
    onError: (err) => {
      const code = err.response?.data?.code;
      const msg = err.response?.data?.message;
      if (code === 'CONFLICT') {
        setError('email', { message: 'Email already registered' });
      } else {
        toast.error(msg || 'Registration failed');
      }
    },
  });

  const onSubmit = (data) => doRegister(data);

  // ── Success screen ────────────────────────────────────────────────────────
  if (registered) {
    return (
      <PageWrapper>
        <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6"
            >
              <Check className="w-10 h-10 text-green-600" />
            </motion.div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              Account created! 🎉
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-2">
              We've sent a verification link to your email.
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-8">
              Please check your inbox and verify your email before logging in.
            </p>

            <Button
              fullWidth
              size="lg"
              onClick={() => navigate('/login')}
              icon={ArrowRight}
              iconPosition="right"
            >
              Go to Sign In
            </Button>

            <p className="text-sm text-slate-500 mt-4">
              Didn't get the email?{' '}
              <button
                onClick={() => toast.success('Check your spam folder or try again')}
                className="text-primary-600 hover:underline font-medium"
              >
                Resend
              </button>
            </p>
          </motion.div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mb-8"
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
              Create account
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Join thousands buying & selling smart devices
            </p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
          >
            {/* Role selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                I want to
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'user', icon: ShoppingBag, label: 'Buy devices', desc: 'Browse & purchase' },
                  { value: 'seller', icon: Store, label: 'Sell devices', desc: 'List & earn' },
                ].map((option) => (
                  <motion.button
                    key={option.value}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleRoleChange(option.value)}
                    className={`
                      relative p-4 rounded-xl border-2 text-left transition-all duration-200
                      ${role === option.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }
                    `}
                  >
                    <option.icon className={`w-6 h-6 mb-2 ${role === option.value ? 'text-primary-600' : 'text-slate-400'}`} />
                    <p className={`text-sm font-semibold ${role === option.value ? 'text-primary-700 dark:text-primary-400' : 'text-slate-700 dark:text-slate-200'}`}>
                      {option.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {option.desc}
                    </p>
                    {role === option.value && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            <Input
              label="Full name"
              placeholder="John Doe"
              icon={User}
              error={errors.name?.message}
              autoComplete="name"
              {...register('name')}
            />

            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              icon={Mail}
              error={errors.email?.message}
              autoComplete="email"
              {...register('email')}
            />

            {/* Password with strength indicator */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  className={`input-base pl-10 pr-10 ${errors.password ? 'border-red-400' : ''}`}
                  {...register('password', {
                    onChange: (e) => setPasswordValue(e.target.value),
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength bar */}
              {passwordValue && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-1.5 pt-1"
                >
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i < strength.score ? strength.color : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${
                    strength.score <= 2 ? 'text-red-500' :
                    strength.score <= 3 ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    {strength.label}
                  </p>
                </motion.div>
              )}

              {errors.password && (
                <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isPending}
              icon={ArrowRight}
              iconPosition="right"
            >
              Create Account
            </Button>
          </motion.form>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6"
          >
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-primary-600 hover:text-primary-700 font-semibold"
            >
              Sign in
            </Link>
          </motion.p>

          <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4">
            By signing up you agree to our{' '}
            <span className="text-primary-600 cursor-pointer">Terms</span> and{' '}
            <span className="text-primary-600 cursor-pointer">Privacy Policy</span>
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}