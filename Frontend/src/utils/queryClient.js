import { QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors
          const status = error?.response?.status;
          if (status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        onError: (error) => {
          const status = error?.response?.status;
          // Don't show toast for auth errors (handled per-mutation)
          if (status === 401 || status === 403) return;
          const message = error?.response?.data?.message || 'Something went wrong';
          toast.error(message);
        },
      },
    },
  });