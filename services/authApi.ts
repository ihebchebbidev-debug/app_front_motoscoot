/**
 * Auth API — wraps the backend's /api/auth/* and /api/users/* endpoints.
 *
 * Backend routes (from BackendNodeJs/src/routes/auth.js & users.js):
 *   POST   /auth/register         → create account, returns { token, user }
 *   POST   /auth/login            → returns { token, user }
 *   POST   /auth/logout           → invalidates token (server-side, optional)
 *   GET    /auth/me               → current user from JWT
 *   POST   /auth/clerk            → exchange Clerk session for an internal JWT
 *   POST   /auth/forgot-password  → send password reset email
 *   POST   /auth/reset-password   → reset password with token
 *   PUT    /users/profile         → update current user profile (auth required)
 *   PUT    /users/password        → change password (auth required)
 */
import { apiClient, tokenStorage } from './apiClient';

export interface BackendUser {
  id: number | string;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  whatsapp?: string;
  avatar?: string;
  avatar_url?: string;
  city?: string;
  governorate?: string;
  member_type?: 'individual' | 'pro' | 'Particulier' | 'Pro';
  account_type?: 'individual' | 'pro';
  shop_name?: string;
  shop_address?: string;
  shop_logo?: string;
  is_verified?: boolean;
  created_at?: string;
  role?: 'user' | 'pro' | 'admin' | 'moderator';
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp: string;
  avatar: string;
  memberType: 'Particulier' | 'Pro';
  city: string;
  governorate?: string;
  bio?: string;
  /** Free-text street address (saved alongside lat/lng from the map picker). */
  address?: string;
  /** Map coordinates picked by the user on the dashboard map. */
  latitude?: number;
  longitude?: number;
  /** Pro-account fields. Empty/undefined for Particulier accounts. */
  shopName?: string;
  shopAddress?: string;
  shopLogo?: string;
  isVerified: boolean;
  createdAt?: string;
  /** Backend role — 'admin' / 'moderator' = staff. */
  role?: 'user' | 'pro' | 'admin' | 'moderator';
}

/** Map a backend user row into the frontend UserProfile shape. */
export function mapBackendUser(u: BackendUser): UserProfile {
  // Split full_name if first/last not provided
  let firstName = u.first_name || '';
  let lastName = u.last_name || '';
  if (!firstName && !lastName && u.full_name) {
    const parts = u.full_name.trim().split(/\s+/);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ');
  }

  // Backend canonical field is `seller_type` ('Particulier' | 'Pro').
  // Older / legacy responses may carry `member_type` or `account_type` instead.
  const memberRaw = ((u as any).seller_type || u.member_type || u.account_type || 'individual')
    .toString()
    .toLowerCase();
  const memberType: UserProfile['memberType'] =
    memberRaw === 'pro' || memberRaw === 'professional' ? 'Pro' : 'Particulier';

  // Coerce numeric strings (Postgres double precision often comes back as string
  // depending on the driver config) and reject NaN.
  const toNum = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    id: String(u.id),
    firstName,
    lastName,
    email: u.email,
    phone: u.phone || '',
    whatsapp: u.whatsapp || u.phone || '',
    avatar: u.avatar || u.avatar_url || '',
    memberType,
    city: u.city || u.governorate || '',
    governorate: u.governorate || undefined,
    bio: (u as any).bio || undefined,
    address: (u as any).address || undefined,
    latitude: toNum((u as any).latitude),
    longitude: toNum((u as any).longitude),
    shopName: u.shop_name || undefined,
    shopAddress: u.shop_address || undefined,
    shopLogo: u.shop_logo || undefined,
    isVerified: !!u.is_verified,
    createdAt: u.created_at,
    role: u.role,
  };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterIndividualPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  city: string;
  account_type: 'individual';
  phone?: string;
}

export interface RegisterProPayload {
  email: string;
  password: string;
  shop_name: string;
  full_name: string;
  /** Optional split-name fields. When provided, persisted alongside full_name. */
  first_name?: string;
  last_name?: string;
  shop_address: string;
  shop_logo?: string;
  account_type: 'pro';
  phone?: string;
  /** Optional but recommended — used to filter Pro shops by region. */
  governorate?: string;
  city?: string;
}

export type RegisterPayload = RegisterIndividualPayload | RegisterProPayload;

/**
 * Map the FE-friendly register payload into the snake_case shape the BE expects.
 * BE requires `full_name` + `seller_type`; we compose them here so the FE form
 * stays ergonomic (first/last + account_type) without breaking the contract.
 */
function toBackendRegisterPayload(p: RegisterPayload): Record<string, any> {
  if (p.account_type === 'individual') {
    const full_name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
    // The signup form's "city" field is actually a governorate selector
    // (see LoginModal — it's populated from useGovernorates()). So we map it
    // to `governorate` and leave `city` empty until the user picks one when
    // depositing an ad. This avoids storing the same value in both columns
    // and lets `StepPublish` filter cities correctly.
    return {
      email: p.email,
      password: p.password,
      full_name,
      governorate: p.city || undefined,
      city: undefined,
      phone: p.phone,
      seller_type: 'Particulier',
    };
  }
  // Pro
  return {
    email: p.email,
    password: p.password,
    full_name: p.full_name,
    first_name: p.first_name,
    last_name: p.last_name,
    phone: p.phone,
    seller_type: 'Pro',
    shop_name: p.shop_name,
    shop_address: p.shop_address,
    shop_logo: p.shop_logo,
    governorate: p.governorate,
    city: p.city || p.governorate,
  };
}

export interface AuthResponse {
  token: string;
  user: BackendUser;
}

export const authApi = {
  async login(payload: LoginPayload): Promise<{ token: string; user: UserProfile }> {
    const data = await apiClient.post<AuthResponse>('/auth/login', payload, { noAuth: true });
    if (data?.token) tokenStorage.set(data.token);
    return { token: data.token, user: mapBackendUser(data.user) };
  },

  async register(payload: RegisterPayload): Promise<{ token: string; user: UserProfile }> {
    const body = toBackendRegisterPayload(payload);
    const data = await apiClient.post<AuthResponse>('/auth/register', body, { noAuth: true });
    if (data?.token) tokenStorage.set(data.token);
    return { token: data.token, user: mapBackendUser(data.user) };
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Server-side logout is best-effort. Always clear the token locally.
    }
    tokenStorage.clear();
  },

  async me(signal?: AbortSignal): Promise<UserProfile> {
    const data = await apiClient.get<BackendUser | { user: BackendUser }>('/auth/me', { signal });
    const user = (data as any)?.user ? (data as any).user : data;
    return mapBackendUser(user as BackendUser);
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    // BE accepts `full_name`, `phone`, `city`, `governorate`, `bio`, `avatar_url`,
    // `whatsapp`, and (after migration 010) `address` + `latitude` + `longitude`.
    // We send `full_name` composed from first+last whenever either is provided so
    // the change persists even on older BE deployments.
    const payload: Record<string, any> = {};
    if (updates.firstName !== undefined) payload.first_name = updates.firstName;
    if (updates.lastName !== undefined) payload.last_name = updates.lastName;
    if (updates.firstName !== undefined || updates.lastName !== undefined) {
      payload.full_name = `${updates.firstName ?? ''} ${updates.lastName ?? ''}`.trim();
    }
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.whatsapp !== undefined) payload.whatsapp = updates.whatsapp;
    if (updates.city !== undefined) payload.city = updates.city;
    if (updates.governorate !== undefined) payload.governorate = updates.governorate;
    if (updates.bio !== undefined) payload.bio = updates.bio;
    if (updates.address !== undefined) payload.address = updates.address;
    if (updates.latitude !== undefined) payload.latitude = updates.latitude;
    if (updates.longitude !== undefined) payload.longitude = updates.longitude;
    if (updates.avatar !== undefined) payload.avatar_url = updates.avatar;
    // Pro shop fields (migration 011). Backend ignores them silently for Particuliers.
    if (updates.shopName !== undefined)    payload.shop_name    = updates.shopName;
    if (updates.shopAddress !== undefined) payload.shop_address = updates.shopAddress;
    if (updates.shopLogo !== undefined)    payload.shop_logo    = updates.shopLogo;

    // Backend route: PUT /users/profile (NOT /auth/me — that doesn't exist).
    const data = await apiClient.put<BackendUser | { user: BackendUser }>('/users/profile', payload);
    const user = (data as any)?.user ? (data as any).user : data;
    return mapBackendUser(user as BackendUser);
  },

  async changePassword(payload: { oldPassword: string; newPassword: string }): Promise<void> {
    // Backend route: PUT /users/password — expects { current_password, new_password }.
    await apiClient.put('/users/password', {
      current_password: payload.oldPassword,
      new_password: payload.newPassword,
    });
  },

  /**
   * Permanently soft-deletes the current account: anonymizes PII, soft-deletes
   * the user's listings, archives all their conversations, and revokes the
   * current JWT server-side. The local token is cleared on success.
   */
  async deleteAccount(): Promise<void> {
    await apiClient.delete('/users/me');
    tokenStorage.clear();
  },

  async forgotPassword(email: string): Promise<void> {
    // Backend route: POST /auth/forgot-password
    await apiClient.post('/auth/forgot-password', { email }, { noAuth: true });
  },

  async resetPassword(payload: { token: string; password: string }): Promise<void> {
    // Backend route: POST /auth/reset-password
    await apiClient.post('/auth/reset-password', payload, { noAuth: true });
  },

  /** Used by Clerk Google login to mint an internal JWT after social auth. */
  async exchangeClerk(payload: {
    clerk_id: string;
    email?: string;
    full_name?: string;
    avatar_url?: string;
    provider?: string;
  }, clerkToken?: string): Promise<{ token: string; user: UserProfile }> {
    const data = await apiClient.post<AuthResponse>('/auth/clerk', payload, {
      noAuth: true,
      headers: clerkToken ? { Authorization: `Bearer ${clerkToken}` } : {},
    });
    if (data?.token) tokenStorage.set(data.token);
    return { token: data.token, user: mapBackendUser(data.user) };
  },

  /** True if a JWT exists in storage (does NOT verify validity with the backend). */
  hasToken(): boolean {
    return !!tokenStorage.get();
  },

  clearToken(): void {
    tokenStorage.clear();
  },
};

export default authApi;
