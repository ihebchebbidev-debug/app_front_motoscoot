import { useQuery } from '@tanstack/react-query';
import { faqApi, FaqItem } from '../services/miscApi';

/** GET /api/faq — published FAQ entries (optionally filtered by category server-side). */
export const useFaq = (category?: string) => {
  return useQuery<FaqItem[]>({
    queryKey: ['faq', category || 'all'],
    queryFn: ({ signal }) => faqApi.list(category, signal),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: (failureCount, error: any) => {
      if (error?.status >= 400 && error?.status < 500) return false;
      return failureCount < 2;
    },
  });
};
