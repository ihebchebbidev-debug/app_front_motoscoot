import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, garageOwnerApi, type AdminGarageCreatePayload, type DevTicketStatus } from '../services/adminApi';

const retryStrategy = (failureCount: number, error: any) => {
  if (error?.status >= 400 && error?.status < 500) return false;
  return failureCount < 2;
};

const baseOpts = { staleTime: 1000 * 30, retry: retryStrategy };

// ---------- Dashboard ----------
export const useAdminStats = () =>
  useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: ({ signal }) => adminApi.getStats(signal),
    ...baseOpts,
  });

// ---------- Users ----------
export const useAdminUsers = (params?: { search?: string; role?: string }) =>
  useQuery({
    queryKey: ['admin', 'users', params || {}],
    queryFn: ({ signal }) => adminApi.getUsers(params, signal),
    ...baseOpts,
  });

// Paginated variant — returns { users, total, page, limit, total_pages }
// so the admin UI can render proper Previous/Next + page-number controls.
export const useAdminUsersPaginated = (params: {
  page: number;
  limit: number;
  search?: string;
  role?: string;
}) =>
  useQuery({
    queryKey: ['admin', 'users', 'paginated', params],
    queryFn: ({ signal }) => adminApi.getUsersPaginated(params, signal),
    placeholderData: (prev) => prev, // keep previous page visible while next loads
    ...baseOpts,
  });

export const useBanUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ban }: { userId: string; ban: boolean }) =>
      adminApi.banUser(userId, ban),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const useSetUserAvatar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, avatarUrl }: { userId: string; avatarUrl: string | null }) =>
      adminApi.setUserAvatar(userId, avatarUrl),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const useSetUserRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'user' | 'pro' | 'admin' | 'moderator' }) =>
      adminApi.setUserRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const useRemoveUserRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminApi.removeUserRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => {
      // User row is gone — also bust listings cache since their ads were dropped.
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'listings'] });
    },
  });
};

// ---------- Listings moderation ----------
export const useAdminListings = (params?: { status?: string; search?: string }) =>
  useQuery({
    queryKey: ['admin', 'listings', params || {}],
    queryFn: ({ signal }) => adminApi.getAllListings(params, signal),
    ...baseOpts,
  });

// Paginated variant — mirrors useAdminUsersPaginated. Returns
// { listings, total, page, limit, total_pages }.
export const useAdminListingsPaginated = (params: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}) =>
  useQuery({
    queryKey: ['admin', 'listings', 'paginated', params],
    queryFn: ({ signal }) => adminApi.getAllListingsPaginated(params, signal),
    placeholderData: (prev) => prev,
    ...baseOpts,
  });

export const useAdminPendingListings = () =>
  useQuery({
    queryKey: ['admin', 'listings', 'pending'],
    queryFn: ({ signal }) => adminApi.getPendingListings(signal),
    ...baseOpts,
  });

export const useModerateListing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) =>
      adminApi.moderateListing(id, action, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'listings'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      qc.invalidateQueries({ queryKey: ['listings'] });
    },
  });
};

export const useAdminDeleteListing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.deleteListing(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'listings'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      qc.invalidateQueries({ queryKey: ['listings'] });
    },
  });
};

// ---------- Site reviews moderation ----------
export const useAdminSiteReviews = (status: 'pending' | 'published' = 'pending') =>
  useQuery({
    queryKey: ['admin', 'site-reviews', status],
    queryFn: ({ signal }) => adminApi.getSiteReviews(status, signal),
    ...baseOpts,
  });

export const usePublishSiteReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPublished }: { id: number | string; isPublished: boolean }) =>
      adminApi.publishSiteReview(id, isPublished),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'site-reviews'] });
      qc.invalidateQueries({ queryKey: ['site-reviews'] });
    },
  });
};

export const useCreateSiteReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof adminApi.createSiteReview>[0]) => adminApi.createSiteReview(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'site-reviews'] });
      qc.invalidateQueries({ queryKey: ['site-reviews'] });
    },
  });
};

export const useDeleteSiteReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => adminApi.deleteSiteReview(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'site-reviews'] });
      qc.invalidateQueries({ queryKey: ['site-reviews'] });
    },
  });
};

// ---------- Garages admin ----------
export const useAdminGarages = (params?: { search?: string; verified?: 'true' | 'false' }) =>
  useQuery({
    queryKey: ['admin', 'garages', params || {}],
    queryFn: ({ signal }) => adminApi.getAllGarages(params, signal),
    ...baseOpts,
  });

export const useAdminGaragesPaginated = (params: {
  page: number;
  limit: number;
  search?: string;
  verified?: 'true' | 'false';
}) =>
  useQuery({
    queryKey: ['admin', 'garages', 'paginated', params],
    queryFn: ({ signal }) => adminApi.getAllGaragesPaginated(params, signal),
    placeholderData: (prev) => prev,
    ...baseOpts,
  });

export const useSetGarageVerified = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) =>
      adminApi.setGarageVerified(id, verified),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'garages'] });
      qc.invalidateQueries({ queryKey: ['garages'] });
    },
  });
};

export const useCreateAdminGarage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminGarageCreatePayload) => adminApi.createGarage(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'garages'] });
      qc.invalidateQueries({ queryKey: ['garages'] });
    },
  });
};

// ---------- Reports ----------
export const useAdminReports = (resolved = false) =>
  useQuery({
    queryKey: ['admin', 'reports', resolved],
    queryFn: ({ signal }) => adminApi.getReports(resolved, signal),
    ...baseOpts,
  });

export const useResolveReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => adminApi.resolveReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  });
};

// ---------- Ad campaigns ----------
export const useAdminAdCampaigns = (active?: boolean) =>
  useQuery({
    queryKey: ['admin', 'ad-campaigns', active ?? 'all'],
    queryFn: ({ signal }) => adminApi.getAdCampaigns(active, signal),
    ...baseOpts,
  });

export const useAdminAdCampaignAnalytics = (id: string | null, period = 30) =>
  useQuery({
    queryKey: ['admin', 'ad-campaigns', id, 'analytics', period],
    queryFn: ({ signal }) => adminApi.getAdCampaignAnalytics(id as string, period, signal),
    enabled: !!id,
    ...baseOpts,
  });

export const useCreateAdCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => adminApi.createAdCampaign(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ad-campaigns'] }),
  });
};

export const useUpdateAdCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      adminApi.updateAdCampaign(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ad-campaigns'] }),
  });
};

export const useDeleteAdCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteAdCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ad-campaigns'] }),
  });
};

// ---------- FAQ admin ----------
export const useAdminFaqs = () =>
  useQuery({
    queryKey: ['admin', 'faqs'],
    queryFn: ({ signal }) => adminApi.getFaqs(signal),
    ...baseOpts,
  });

export const useCreateFaq = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => adminApi.createFaq(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'faqs'] });
      qc.invalidateQueries({ queryKey: ['faq'] });
    },
  });
};

export const useUpdateFaq = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      adminApi.updateFaq(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'faqs'] });
      qc.invalidateQueries({ queryKey: ['faq'] });
    },
  });
};

export const useDeleteFaq = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteFaq(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'faqs'] });
      qc.invalidateQueries({ queryKey: ['faq'] });
    },
  });
};

// ---------- Contact messages ----------
export const useAdminContactMessages = () =>
  useQuery({
    queryKey: ['admin', 'contact-messages'],
    queryFn: ({ signal }) => adminApi.getContactMessages(signal),
    ...baseOpts,
  });

export const useResolveContactMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.resolveContactMessage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'contact-messages'] }),
  });
};

// ---------- Newsletter ----------
export const useAdminNewsletter = (active?: boolean) =>
  useQuery({
    queryKey: ['admin', 'newsletter', active ?? 'all'],
    queryFn: ({ signal }) => adminApi.getNewsletterSubscribers(active, signal),
    ...baseOpts,
  });

export const useDeleteNewsletterSubscriber = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteNewsletterSubscriber(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'newsletter'] }),
  });
};

// ---------- Garage owner replies (used in GarageDetails, not admin-only) ----------
export const useReplyToGarageReview = (garageId?: number | string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, reply }: { reviewId: number | string; reply: string }) => {
      if (!garageId) return Promise.reject(new Error('garageId required'));
      return garageOwnerApi.replyToReview(garageId, reviewId, reply);
    },
    onSuccess: () => {
      if (garageId) qc.invalidateQueries({ queryKey: ['garage', garageId, 'reviews'] });
    },
  });
};

// ---------- Developer tickets ----------
const DEV_TICKETS_KEY = ['admin', 'dev-tickets'] as const;

export const useAdminDevTickets = (status?: DevTicketStatus | 'all') =>
  useQuery({
    queryKey: [...DEV_TICKETS_KEY, status ?? 'all'],
    queryFn: ({ signal }) => adminApi.getDevTickets(status, signal),
    ...baseOpts,
  });

export const useCreateDevTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; description: string; image_url?: string | null }) =>
      adminApi.createDevTicket(payload),
    onSuccess: (created) => {
      // Optimistically prepend the newly created ticket into every cached
      // dev-tickets list (all filters) so the UI updates instantly without
      // waiting for the background refetch — fixes "ticket created but not
      // visible" when the refetch is slow / coalesced.
      if (created && created.id) {
        const caches = qc.getQueriesData<any[]>({ queryKey: DEV_TICKETS_KEY });
        for (const [key, list] of caches) {
          const filter = (key as any[])[2];
          const matches = filter === 'all' || !filter || filter === created.status;
          if (!matches) continue;
          const arr = Array.isArray(list) ? list : [];
          if (arr.some((t) => t?.id === created.id)) continue;
          qc.setQueryData(key, [created, ...arr]);
        }
      }
      // Then invalidate so the server-truth (with joined creator info) lands.
      return qc.invalidateQueries({ queryKey: DEV_TICKETS_KEY, refetchType: 'active' });
    },
  });
};

export const useUpdateDevTicketStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: DevTicketStatus }) =>
      adminApi.updateDevTicketStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: DEV_TICKETS_KEY }),
  });
};

export const useUpdateDevTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; title: string; description: string; image_url?: string | null }) => adminApi.updateDevTicket(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: DEV_TICKETS_KEY }),
  });
};

export const useDeleteDevTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteDevTicket(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DEV_TICKETS_KEY }),
  });
};
