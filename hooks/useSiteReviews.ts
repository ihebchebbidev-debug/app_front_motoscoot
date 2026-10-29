import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { siteReviewsApi, SiteReview } from '../services/miscApi';

const retryStrategy = (failureCount: number, error: any) => {
  if (error?.status >= 400 && error?.status < 500) return false;
  return failureCount < 3;
};

/** Public testimonials shown on the home page (`Reviews` section). */
export const useSiteReviews = () => {
  return useQuery<SiteReview[]>({
    queryKey: ['site-reviews'],
    queryFn: ({ signal }) => siteReviewsApi.list(signal),
    staleTime: 1000 * 60 * 15,
    retry: retryStrategy,
  });
};

/** POST /api/site-reviews — submit a public testimonial (pending admin moderation). */
export const useSubmitSiteReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { rating: number; content: string; role?: string }) =>
      siteReviewsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-reviews'] });
    },
  });
};
