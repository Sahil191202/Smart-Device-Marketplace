import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, Zap, Send, CheckCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

import { authApi } from '../../api/auth.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageWrapper } from '../../components/layout/PageWrapper';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const { mutate: sendReset, isPending } = useMutation({
    mutationFn: (data) => authApi.forgotPassword(data.email),
    onSuccess: (_, variables) => {
      setSubmittedEmail(variables.email);
      setSubmitted(true);
    },
  });

  return (
    <PageWrapper>
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-6">
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

          <AnimatePresence mode="wait">
            {!submitted ? (
              // ── Request form ────────────────────────────────────────────────
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-5">
                    <Mail className="w-7 h-7 text-primary-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Forgot your password?
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    No worries. Enter your email and we'll send you a reset link.
                  </p>
                </div>

                <form onSubmit={handleSubmit(sendReset)} className="space-y-5">
                  <Input
                    label="Email address"
                    type="email"
                    placeholder="you@example.com"
                    icon={Mail}
                    error={errors.email?.message}
                    autoFocus
                    {...register('email')}
                  />

                  <Button
                    type="submit"
                    fullWidth
                    size="lg"
                    loading={isPending}
                    icon={Send}
                    iconPosition="right"
                  >
                    Send Reset Link
                  </Button>
                </form>

                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 mt-6 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Link>
              </motion.div>
            ) : (
              // ── Success state ───────────────────────────────────────────────
              <motion.div
                key="success"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </motion.div>

                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  Check your inbox
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mb-2">
                  We sent a reset link to
                </p>
                <p className="text-primary-600 font-semibold mb-6">
                  {submittedEmail}
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-8">
                  The link will expire in 10 minutes. Check your spam folder if you don't see it.
                </p>

                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => setSubmitted(false)}
                >
                  Try a different email
                </Button>

                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageWrapper>
  );
}