import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, Zap, ArrowRight } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

import { authApi } from '../../api/auth.api';
import { Button } from '../../components/ui/Button';
import { PageWrapper } from '../../components/layout/PageWrapper';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying'); // verifying | success | error

  const { mutate: verify } = useMutation({
    mutationFn: () => authApi.verifyEmail(token),
    onSuccess: () => setStatus('success'),
    onError: () => setStatus('error'),
  });

  useEffect(() => {
    if (token) {
      verify();
    } else {
      setStatus('error');
    }
  }, [token]);

  return (
    <PageWrapper>
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">

          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-10">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              Smart<span className="text-primary-600">Market</span>
            </span>
          </div>

          {/* Verifying */}
          {status === 'verifying' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto">
                <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Verifying your email...
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Please wait a moment
              </p>
            </motion.div>
          )}

          {/* Success */}
          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-5"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto"
              >
                <CheckCircle className="w-10 h-10 text-green-600" />
              </motion.div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Email verified! 🎉
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                Your account is now active. You can now sign in and start using SmartMarketplace.
              </p>
              <Button
                fullWidth
                size="lg"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => navigate('/login')}
              >
                Sign In Now
              </Button>
            </motion.div>
          )}

          {/* Error */}
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-5"
            >
              <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Verification failed
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                This link may have expired or already been used. Links are valid for 24 hours.
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  fullWidth
                  size="lg"
                  onClick={() => navigate('/login')}
                >
                  Go to Sign In
                </Button>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Need a new link?{' '}
                  <Link
                    to="/register"
                    className="text-primary-600 font-medium hover:underline"
                  >
                    Re-register
                  </Link>
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}