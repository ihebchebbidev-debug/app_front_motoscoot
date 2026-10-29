
import React, { useState, useEffect, useCallback, useMemo, memo, Suspense, lazy, useRef } from 'react';
import { 
  Eye, 
  Settings, 
  LogOut, 
  List,
  User as UserIcon,
  Bell,
  ShieldCheck,
  Heart,
  CheckCircle2,
  Trash2,
  MessageSquare,
  Camera,
} from 'lucide-react';
import { Skeleton } from './ui/Skeleton';
import { BasePageProps } from '../types';
import { useUser } from '../context/UserContext';
import { useFavorites } from '../context/FavoritesContext';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { monitoring } from '../utils/monitoring';
import { useUnreadConversationsCount } from '../hooks/useConversations';
import { useConfirm } from './admin/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { authApi } from '../services/authApi';
import { useQueryClient } from '@tanstack/react-query';
import { uploadsApi } from '../services/uploadsApi';
import { compressImage } from '../utils/imageCompression';
import navOverview from '../src/assets/nav-overview.webp';
import navAds from '../src/assets/nav-ads.webp';
import navMessages from '../src/assets/nav-messages.webp';
import navFavorites from '../src/assets/nav-favorites.webp';
import navProfile from '../src/assets/nav-profile.webp';
import navAdmin from '../src/assets/nav-admin.webp';
import SEO from './common/SEO';

const MOBILE_NAV_ICONS: Record<string, string> = {
  overview: navOverview,
  'my-ads': navAds,
  messages: navMessages,
  favorites: navFavorites,
  settings: navProfile,
  admin: navAdmin,
};

// --- TABS LAZY LOADING ---
const OverviewTab = lazy(() => import('./dashboard/OverviewTab'));
const MyAdsTab = lazy(() => import('./dashboard/MyAdsTab'));
const SettingsTab = lazy(() => import('./dashboard/SettingsTab'));
const FavoritesTab = lazy(() => import('./dashboard/FavoritesTab'));
const MessagesTab = lazy(() => import('./dashboard/MessagesTab'));

// --- TYPES ---
type DashboardTab = 'overview' | 'my-ads' | 'favorites' | 'messages' | 'settings';
type DashboardNavItem = NavItem | { id: 'admin'; label: string; icon: React.ElementType };

interface NavItem {
  id: DashboardTab;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: "Aperçu", icon: Eye },
  { id: 'my-ads', label: "Annonces", icon: List },
  { id: 'messages', label: "Messages", icon: MessageSquare },
  { id: 'favorites', label: "Favoris", icon: Heart },
  { id: 'settings', label: "Profil", icon: UserIcon },
];

const S = {
  // pb-28 leaves room for the fixed mobile bottom-nav (h≈80px) + iOS safe-area.
  Wrapper: "min-h-screen bg-muted font-sans selection:bg-orange-100 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-0",
  MainContainer: "max-w-7xl mx-auto px-4 md:px-8 pt-3 md:pt-6 pb-6 md:pb-12 flex flex-col md:flex-row gap-4 md:gap-8 items-start",
  
  Sidebar: "hidden md:flex w-[280px] h-[75vh] bg-card rounded-2xl border border-gray-100 flex-shrink-0 flex-col sticky top-28 z-40 shadow-sm overflow-hidden",
  NavSection: "px-4 py-6",
  NavBtn: (active: boolean) => `
    w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group outline-none
    ${active 
      ? 'bg-primary-600 text-white shadow-lg shadow-orange-600/20' 
      : 'text-muted-foreground hover:text-primary-600 hover:bg-orange-50/50'}
  `,
  
  MobileNav: "fixed bottom-0 left-0 right-0 z-[100] bg-card/95 backdrop-blur-xl border-t border-gray-100 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden flex justify-around items-center shadow-[0_-10px_30px_rgba(0,0,0,0.08)]",
  MobileNavBtn: (active: boolean) => `
    flex flex-col items-center gap-1 transition-all active:scale-95 flex-1 py-1.5 rounded-xl
    ${active ? 'text-primary-600' : 'text-gray-400'}
  `,
  
  Content: "flex-1 w-full min-w-0 transition-all duration-300",
};

const SidebarNavItem = memo(({ item, active, onClick, badge }: { item: DashboardNavItem, active: boolean, onClick: () => void, badge?: number }) => (
  <button
    onClick={onClick}
    className={S.NavBtn(active)}
    type="button"
    role="tab"
    aria-selected={active}
  >
    <item.icon size={16} strokeWidth={2} />
    <span className="uppercase flex-1 text-left">{item.label}</span>
    {badge != null && badge > 0 && (
      <span className={`min-w-[20px] text-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${
        active ? 'bg-white/25 text-white' : 'bg-primary-600 text-white'
      }`}>
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
));

const UserProfileSidebar = memo(() => {
  const { user, isLoading, updateProfile } = useUser();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setIsUploading(true);
    try {
      const file = await compressImage(raw);
      const { url } = await uploadsApi.single(file);
      await updateProfile({ avatar: url } as any);
      addToast('Photo de profil mise à jour', 'success');
    } catch (err: any) {
      addToast(err?.message || "Erreur lors de l'upload", 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  if (isLoading || !user) {
    return (
      <div className="p-8 border-b border-gray-50 flex flex-col gap-4">
        <Skeleton className="w-14 h-14 rounded-[6px]" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  return (
    <div className="p-8 border-b border-gray-50 bg-gradient-to-br from-white to-gray-50/50">
      <div className="flex items-center gap-4 mb-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            aria-label="Changer la photo de profil"
            className="group relative w-14 h-14 rounded-[6px] bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0 overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {(user.memberType === 'Pro' && user.shopLogo) ? (
              <img src={user.shopLogo} alt="" className="w-full h-full object-cover bg-white" />
            ) : user.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</>
            )}
            <span className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${isUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <Camera size={18} className="text-white" />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div className="absolute -bottom-1 -right-1 bg-card rounded-full p-1 shadow-sm border border-gray-100 pointer-events-none">
            <ShieldCheck size={14} className="text-emerald-500" strokeWidth={2} />
          </div>
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="font-bold text-gray-900 text-base truncate leading-tight">
            {user.firstName} {user.lastName}
          </h3>
          <span className="text-gray-400 text-[9px] font-bold uppercase bg-card px-2 py-0.5 rounded-full border border-gray-100 w-fit mt-1">
            {user.memberType}
          </span>
        </div>
      </div>
    </div>
  );
});

const Dashboard: React.FC<BasePageProps> = ({ onNavigate, onLogout, isLoggedIn, initialTab }) => {
  const [activeMenu, setActiveMenu] = useState<DashboardTab>((initialTab as DashboardTab) || 'overview');
  const { user, updateProfile } = useUser();
  const { addToast } = useToast();
  const mobileAvatarRef = useRef<HTMLInputElement>(null);
  const [isUploadingMobileAvatar, setIsUploadingMobileAvatar] = useState(false);
  const handleMobileAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setIsUploadingMobileAvatar(true);
    try {
      const file = await compressImage(raw);
      const { url } = await uploadsApi.single(file);
      await updateProfile({ avatar: url } as any);
      addToast('Photo de profil mise à jour', 'success');
    } catch (err: any) {
      addToast(err?.message || "Erreur lors de l'upload", 'error');
    } finally {
      setIsUploadingMobileAvatar(false);
      e.target.value = '';
    }
  };
  const { favorites, favoriteListings, toggleFavorite, refresh: refreshFavorites } = useFavorites();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const { data: unreadCount = 0 } = useUnreadConversationsCount();
  const isAdminUser = user?.role === 'admin' || user?.role === 'moderator';
  const navItems = useMemo<DashboardNavItem[]>(
    () => isAdminUser ? [...NAV_ITEMS, { id: 'admin', label: 'Administration', icon: Settings }] : NAV_ITEMS,
    [isAdminUser],
  );
  // Prefer server-hydrated list length; fall back to local ID set (covers the
  // brief window before the first refresh resolves so the badge isn't 0).
  const favoritesCount = favoriteListings?.length ?? (favorites.listings?.length || 0);

  // Make sure the favorites tab always shows the latest server snapshot
  // when the user opens it (in case they hearted items elsewhere).
  useEffect(() => {
    if (activeMenu === 'favorites') {
      refreshFavorites();
    }
  }, [activeMenu, refreshFavorites]);

  useEffect(() => {
    const tabFromUrl = (initialTab as DashboardTab) || 'overview';
    if (tabFromUrl !== activeMenu) {
      setActiveMenu(tabFromUrl);
    }
  }, [initialTab]);

  useEffect(() => {
    if (isLoggedIn === false) onNavigate?.('home');
  }, [isLoggedIn, onNavigate]);

  const handleLogoutClick = useCallback(async () => {
    const ok = await confirm({
      title: 'Se déconnecter ?',
      message: 'Vous devrez vous reconnecter pour accéder à votre tableau de bord.',
      confirmLabel: 'Se déconnecter',
      variant: 'info',
    });
    if (!ok) return;
    monitoring.trackEvent('UserLogoutInitiated', { userId: user?.id });
    await onLogout?.();
  }, [onLogout, user?.id, confirm]);

  const handleDeleteAccountClick = useCallback(async () => {
    const ok = await confirm({
      title: 'Supprimer définitivement votre compte ?',
      message: 'Cette action est irréversible. Toutes vos annonces seront retirées et vos conversations archivées.',
      confirmLabel: 'Supprimer mon compte',
      variant: 'danger',
    });
    if (!ok) return;
    monitoring.trackEvent('UserAccountDeletionInitiated', { userId: user?.id });
    setIsDeleting(true);
    try {
      await authApi.deleteAccount();
      // Wipe all cached user-scoped data and bounce to home as a logged-out user.
      queryClient.clear();
      addToast('Votre compte a été supprimé.', 'success');
      await onLogout?.();
      onNavigate?.('home');
    } catch (e: any) {
      monitoring.captureException(e instanceof Error ? e : new Error(String(e)), { scope: 'deleteAccount' });
      addToast(e?.message || 'Suppression impossible. Réessayez.', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [user?.id, confirm, addToast, queryClient, onLogout, onNavigate]);

  const savedListings = useMemo(() => {
    // Server-hydrated favorite listings (from the backend) — source of truth
    // when logged in. Empty array until the first refresh resolves.
    return favoriteListings || [];
  }, [favoriteListings]);

  if (!isLoggedIn) return null;

  return (
    <div className={S.Wrapper} style={{ letterSpacing: '0px' }}>
      <SEO title="Mon compte" description="Tableau de bord MotoScoot — gérez vos annonces, messages et favoris." noIndex url="/mon-compte" />
      <div className={S.MainContainer}>
        <aside className={S.Sidebar}>
          {activeMenu !== 'my-ads' && activeMenu !== 'messages' && activeMenu !== 'favorites' && (
            <UserProfileSidebar />
          )}

          <nav className={S.NavSection} role="tablist">
            <div className="space-y-2">
              {navItems.map(item => {
                const badge =
                  item.id === 'messages' ? unreadCount :
                  item.id === 'favorites' ? favoritesCount :
                  undefined;
                return (
                  <SidebarNavItem
                    key={item.id}
                    item={item}
                    active={activeMenu === item.id}
                    badge={badge}
                    onClick={() => {
                      if (item.id === 'admin') {
                        onNavigate?.('admin');
                        return;
                      }
                      setActiveMenu(item.id);
                      onNavigate?.('dashboard', { tab: item.id });
                    }}
                  />
                );
              })}
            </div>
          </nav>

          <div className="p-8 mt-auto border-t border-gray-50 bg-gray-50/20 space-y-4">
            <button 
              onClick={handleDeleteAccountClick} 
              disabled={isDeleting}
              className="flex items-center gap-3 text-[12px] font-extrabold uppercase tracking-wider text-gray-400 hover:text-red-600 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={16} className="group-hover:scale-110 transition-transform" /> 
              <span>{isDeleting ? 'Suppression…' : 'Supprimer le compte'}</span>
            </button>
            <button 
              onClick={handleLogoutClick} 
              className="flex items-center gap-3 text-[12px] font-extrabold uppercase tracking-wider text-gray-400 hover:text-gray-900 transition-colors group"
            >
              <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" /> 
              <span>Déconnexion</span>
            </button>
          </div>
        </aside>

        <nav className={S.MobileNav}>
          {navItems.map(item => {
            const isActive = activeMenu === item.id;
            const badge =
              item.id === 'messages' ? unreadCount :
              item.id === 'favorites' ? favoritesCount :
              0;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'admin') {
                    onNavigate?.('admin');
                    return;
                  }
                  setActiveMenu(item.id);
                  onNavigate?.('dashboard', { tab: item.id });
                }}
                className={S.MobileNavBtn(isActive)}
              >
                <div className="relative">
                  {MOBILE_NAV_ICONS[item.id] ? (
                    <img src={MOBILE_NAV_ICONS[item.id]} alt="" className={`w-7 h-7 object-contain transition-all ${isActive ? '' : 'opacity-60 grayscale'}`} />
                  ) : (
                    <item.icon size={22} strokeWidth={2} />
                  )}
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-primary-600 text-white text-[9px] font-extrabold flex items-center justify-center tabular-nums">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-bold uppercase text-foreground">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <main className={S.Content} key={activeMenu}>
          <ErrorBoundary>
            <Suspense fallback={
              <div className="p-12 flex flex-col gap-4 max-w-3xl mx-auto">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <Skeleton className="h-40 rounded-xl" />
                  <Skeleton className="h-40 rounded-xl" />
                </div>
              </div>
            }>
              <div className="animate-fade-in outline-none">
                {/* Mobile-only greeting card — gives users a sense of identity
                    on small screens since the desktop sidebar profile is hidden. */}
                {user && activeMenu !== 'my-ads' && activeMenu !== 'messages' && activeMenu !== 'favorites' && (
                  <div className="md:hidden mb-4 bg-card rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => mobileAvatarRef.current?.click()}
                        disabled={isUploadingMobileAvatar}
                        aria-label="Changer la photo de profil"
                        className="group relative w-12 h-12 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center text-white font-bold text-base shadow-md overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
                      >
                        {(user.memberType === 'Pro' && user.shopLogo) ? (
                          <img src={user.shopLogo} alt="" className="w-full h-full object-cover bg-white" />
                        ) : user.avatar ? (
                          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</>
                        )}
                        <span className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${isUploadingMobileAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-active:opacity-100'}`}>
                          <Camera size={14} className="text-white" />
                        </span>
                      </button>
                      <input
                        ref={mobileAvatarRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleMobileAvatarChange}
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 bg-card rounded-full p-0.5 shadow-sm border border-gray-100 pointer-events-none">
                        <ShieldCheck size={11} className="text-emerald-500" strokeWidth={2.5} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Bonjour</p>
                      <h2 className="text-base font-extrabold text-gray-900 truncate leading-tight">
                        {user.firstName} {user.lastName}
                      </h2>
                    </div>
                    <button
                      onClick={handleLogoutClick}
                      className="shrink-0 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 hover:text-red-600 active:scale-95 transition-all px-3 py-2 rounded-xl bg-gray-50"
                      aria-label="Se déconnecter"
                    >
                      <LogOut size={14} />
                      <span>Sortir</span>
                    </button>
                  </div>
                )}
                {activeMenu === 'overview' && <OverviewTab onNavigate={onNavigate as any} />}
                {activeMenu === 'my-ads' && <MyAdsTab onNavigate={onNavigate as any} />}
                {activeMenu === 'messages' && <MessagesTab />}
                {activeMenu === 'favorites' && (
                  <FavoritesTab 
                    listings={savedListings} 
                    onToggleFavorite={toggleFavorite} 
                    onNavigate={onNavigate as any} 
                  />
                )}
                {activeMenu === 'settings' && <SettingsTab onUpdate={() => {}} />}

                {/* Mobile-only account actions — sidebar is hidden on mobile,
                    so users need a way to delete their account from the Profil tab. */}
                {activeMenu === 'settings' && (
                  <div className="md:hidden mt-6 bg-card rounded-2xl border border-red-100 shadow-sm p-5">
                    <h3 className="text-sm font-extrabold text-foreground mb-1">Zone sensible</h3>
                    <p className="text-xs text-gray-500 mb-4">La suppression du compte est définitive.</p>
                    <button
                      onClick={handleDeleteAccountClick}
                      disabled={isDeleting}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 text-red-600 font-bold text-sm border border-red-100 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      <span>{isDeleting ? 'Suppression…' : 'Supprimer mon compte'}</span>
                    </button>
                  </div>
                )}
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      {confirmDialog}
    </div>
  );
};

export default memo(Dashboard);
