import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, tokenStorage } from '../services/apiClient';
import { listingsApi, mapBackendListing, BackendListing } from '../services/listingsApi';
import { Listing } from '../types';
import { useUser } from '../context/UserContext';

/**
 * Lists the authenticated user's own listings, with mutation helpers used by
 * the dashboard MyAds tab (delete, set status, update price).
 */
export const useMyListings = () => {
  const { user } = useUser();
  const enabled = !!tokenStorage.get() && !!user?.id;

  return useQuery<Listing[]>({
    queryKey: ['listings', 'mine', user?.id],
    enabled,
    queryFn: async ({ signal }) => {
      if (!user?.id) return [];
      const data = await apiClient.get<BackendListing[]>(`/listings/user/${user.id}`, { signal });
      // Attach the raw backend row on each mapped Listing so the dashboard's
      // "Edit" modal can prefill technical fields with the original numeric
      // values (year, mileage, cc, etc.) instead of the formatted strings.
      return (Array.isArray(data) ? data : []).map((row) => {
        const mapped = mapBackendListing(row) as Listing & { _raw?: BackendListing };
        mapped._raw = row;
        return mapped;
      });
    },
    staleTime: 1000 * 60,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 2;
    },
  });
};

export const useDeleteListing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => listingsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['user', 'me', 'stats'] });
    },
  });
};

export const useSetListingStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number | string; status: 'active' | 'sold' | 'expired' | 'draft' | 'pending' }) =>
      apiClient.patch(`/listings/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['user', 'me', 'stats'] });
    },
  });
};

export const useUpdateListingPrice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, price }: { id: number | string; price: number }) => listingsApi.update(id, { price }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listings'] });
    },
  });
};

/**
 * Full listing update — used by the MyAds "Edit" modal so sellers can change
 * any field (title, description, price, technical specs, location, equipment,
 * images), not just the price. Server enforces ownership.
 */
export const useUpdateListing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: Record<string, any> }) =>
      listingsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['user', 'me', 'stats'] });
    },
  });
};
