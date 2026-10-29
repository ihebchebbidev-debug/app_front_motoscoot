import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Plus, 
  Heart, 
  LogOut, 
  LayoutDashboard, 
  ChevronDown,
  LogIn,
  UserPlus,
  List,
  User,
  Bell,
  Settings,
  HelpCircle,
  Newspaper,
  Wrench,
  Info,
  ChevronRight,
  UserCircle,
  Search,
  Scale,
  Layers,
  MessageSquare
} from 'lucide-react';
import { useFavorites } from '../../context/FavoritesContext';
import { throttle } from '../../utils/perfUtils';
import { useAppNavigation } from '../../context/NavigationContext';
import { useUser } from '../../context/UserContext';
import { useUnreadConversationsCount, useConversationsRealtime } from '../../hooks/useConversations';

// Illustrated mobile-sidebar account icons (orange with white inside) — gives
// the menu a friendlier, "vibe-coded" cartoon feel instead of generic line
// icons. Lazy-decoded so they don't block first paint.
import iconSearch from '../../src/assets/sidebar/icon-search.png';
import iconSell from '../../src/assets/sidebar/icon-sell-3d.webp';
import iconSpecs from '../../src/assets/sidebar/icon-specs-3d.webp';
import iconCompare from '../../src/assets/sidebar/icon-compare-3d.webp';
import iconMessages from '../../src/assets/sidebar/icon-messages-3d.webp';
import iconHeart from '../../src/assets/sidebar/icon-heart-3d.webp';
import iconAdmin from '../../src/assets/sidebar/icon-admin-3d.webp';
import iconWrench from '../../src/assets/sidebar/icon-garage-3d.webp';
import iconTips from '../../src/assets/sidebar/icon-tips-3d.webp';
import iconNews from '../../src/assets/sidebar/icon-news-3d.webp';
import iconProfile from '../../src/assets/sidebar/icon-profile-3d.webp';
import iconDashboard from '../../src/assets/sidebar/icon-dashboard-3d.webp';
import iconLogout from '../../src/assets/sidebar/icon-logout.png';

/**
 * Compute up to 2-letter uppercase initials from a user profile.
 * Falls back to email local-part, then to "?" so the avatar bubble
 * is never empty.
 */
const getUserInitials = (user?: {
  firstName?: string;
  lastName?: string;
  email?: string;
}): string => {
  if (!user) return '?';
  const first = (user.firstName || '').trim();
  const last = (user.lastName || '').trim();
  if (first || last) {
    const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    if (initials) return initials;
  }
  if (user.email) return user.email.slice(0, 2).toUpperCase();
  return '?';
};


interface HeaderProps {
  variant?: 'transparent' | 'white';
}

const Header: React.FC<HeaderProps> = ({ 
  variant = 'transparent'
}) => {
  const { navigateTo, isLoggedIn, triggerLogin, logout, currentView } = useAppNavigation();
  const { user } = useUser();
  const initials = getUserInitials(user);
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.email || 'Mon compte';
  // Admin detection — primary signal is the backend role, but we also
  // recognize the canonical admin@motoscoot.* mailbox as a safety net so
  // the badge shows correctly even if the role field hasn't been hydrated
  // yet (e.g. right after login, before profile refresh).
  const adminEmail = (user?.email || '').trim().toLowerCase();
  const isAdminEmail = /^admin@motoscoot\.(com|tn)$/.test(adminEmail);
  const isAdminUser = isLoggedIn && (user?.role === 'admin' || user?.role === 'moderator' || isAdminEmail);
  const adminLabel = user?.role === 'moderator' ? 'Modérateur' : 'Admin';

  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNewsMenuOpen, setIsNewsMenuOpen] = useState(false);
  const [isTechMenuOpen, setIsTechMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const newsMenuRef = useRef<HTMLDivElement>(null);
  const techMenuRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  
  const { favoritesCount } = useFavorites();
  // Realtime socket: keeps the unread badge fresh without polling. The hook
  // also returns `connected` which we feed back into the unread-count query
  // so it stops polling once the websocket is live (one less HTTP round-trip
  // per minute per logged-in user).
  const { connected: socketConnected } = useConversationsRealtime();
  const { data: unreadMessagesCount = 0 } = useUnreadConversationsCount({ socketConnected });

  useEffect(() => {
    const handleScroll = throttle(() => {
      const scrolled = window.scrollY > 20;
      setIsScrolled(prev => prev !== scrolled ? scrolled : prev);
    }, 50);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track mobile viewport so inner pages (tech specs, news, tips, …) can
  // force a solid header on phones — their content has no hero image, so a
  // transparent header would render white-on-white and be unusable.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobileViewport(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (isMobileSheetOpen) {
      document.body.classList.add('lock-scroll');
    } else {
      document.body.classList.remove('lock-scroll');
    }
    return () => document.body.classList.remove('lock-scroll');
  }, [isMobileSheetOpen]);

  // Admin top bar — only shown when an admin/moderator is logged in AND
  // they aren't already inside the admin console. We push everything else
  // down by the bar's height (36px) via a body padding so the fixed
  // header and page content don't slide under it.
  const showAdminBar = isAdminUser && currentView !== 'admin';
  const ADMIN_BAR_HEIGHT = 36;
  useEffect(() => {
    if (showAdminBar) {
      document.body.style.paddingTop = `${ADMIN_BAR_HEIGHT}px`;
    } else {
      document.body.style.paddingTop = '';
    }
    return () => { document.body.style.paddingTop = ''; };
  }, [showAdminBar]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (newsMenuRef.current && !newsMenuRef.current.contains(event.target as Node)) {
        setIsNewsMenuOpen(false);
      }
      if (techMenuRef.current && !techMenuRef.current.contains(event.target as Node)) {
        setIsTechMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavClick = useCallback((view: any, params?: any) => {
    setIsMobileSheetOpen(false);
    setIsNewsMenuOpen(false);
    setIsTechMenuOpen(false);
    setIsUserMenuOpen(false);
    navigateTo(view, params);
  }, [navigateTo]);

  // On mobile, every route except the home hero gets a solid header by
  // default so the logo/CTA stay legible without requiring scroll.
  const forceMobileSolid = isMobileViewport && currentView !== 'home';
  const isSolid = variant === 'white' || isScrolled || forceMobileSolid;
  
  const linkBaseClasses = `font-bold text-sm transition-all duration-300 focus:outline-none ${
    !isSolid ? 'text-white hover:text-white/70' : 'text-gray-700 hover:text-primary-600'
  }`;

  const headerIconButtonClasses = `flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
    !isSolid ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
  }`;

  const LOGO_COLOR = "https://www.moto-scoot.tn/site-logo/logo-color.svg";
  const LOGO_WHITE = "https://www.moto-scoot.tn/site-logo/logo-white.svg";

  const MenuLink = ({ icon: Icon, image, label, subLabel, onClick, badge, variant = 'default', tag }: any) => {
    const isPrimary = variant === 'primary';
    return (
      <div className="px-5">
        <button
          onClick={onClick}
          className={`w-full flex items-center justify-between px-4 py-3.5 my-1.5 rounded-2xl border transition-all active:scale-[0.99] ${
            isPrimary
              ? 'bg-orange-50 border-orange-100'
              : 'bg-card border-gray-100 hover:border-gray-200 hover:bg-gray-50/60'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPrimary ? 'bg-orange-50' : 'bg-white'}`}>
              {image ? (
                <img
                  src={image}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  decoding="async"
                  width={28}
                  height={28}
                  className="w-7 h-7 object-contain"
                />
              ) : isPrimary ? (
                <Plus size={20} strokeWidth={3} className="text-primary-600" />
              ) : Icon ? (
                <Icon size={20} strokeWidth={2.25} className="text-primary-600" />
              ) : null}
            </div>
            <div className="flex flex-col items-start min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-black truncate text-gray-900">{label}</span>
                {tag && <span className="text-primary-600 text-[12px] font-black">({tag})</span>}
                {badge && <span className="bg-primary-600 text-white text-[11px] font-black px-1.5 py-0.5 rounded-full uppercase">{badge}</span>}
              </div>
              {subLabel && <span className="text-[12px] font-medium text-gray-400">{subLabel}</span>}
            </div>
          </div>
          <ChevronRight size={16} className="shrink-0 text-gray-300" />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Admin top bar — visible only to admins/moderators (or the canonical
          admin@ mailbox) and only when they aren't already inside /admin. */}
      {showAdminBar && (
        <button
          type="button"
          onClick={() => handleNavClick('admin')}
          className="fixed top-0 left-0 right-0 z-[101] h-9 flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 text-white text-[12px] font-black uppercase tracking-wider shadow-md hover:brightness-110 active:brightness-95 transition-all group"
          aria-label="Ouvrir l'interface administrateur"
        >
          <Settings size={13} strokeWidth={3} className="group-hover:rotate-45 transition-transform duration-300" />
          <span>Interface administrateur</span>
          <ChevronRight size={13} strokeWidth={3} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
      <header
        className={`w-full z-[100] fixed left-0 transition-all duration-300 ease-in-out flex items-center ${
          isScrolled ? 'h-[56px]' : 'h-[72px]'
        } ${
          isSolid
            ? 'bg-card/95 backdrop-blur-md border-b border-gray-100 shadow-sm'
            : 'bg-transparent border-transparent'
        }`}
        style={{ top: showAdminBar ? `${ADMIN_BAR_HEIGHT}px` : 0 }}
        role="banner"
      >
        <div className="w-full max-w-[1440px] mx-auto px-6 md:px-16 lg:px-32 flex justify-between items-center h-full">
          
          <button 
            className="flex items-center cursor-pointer group transition-transform active:scale-95" 
            onClick={() => handleNavClick('home')}
            aria-label="Retour à l'accueil"
          >
            <img 
              src={isSolid ? LOGO_COLOR : LOGO_WHITE} 
              alt="moto-scoot.tn" width={373} height={48} 
              className="h-[23px] max-[360px]:h-[21px] md:h-7 w-auto object-contain transition-transform duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] group-hover:scale-105"
            />
          </button>

          {/* Navigation Desktop */}
          <nav className="hidden lg:flex items-center gap-8 h-full lg:ml-12 flex-1 justify-end">
            {!isAdminUser && (
              <>
                <div className="flex items-center gap-8 h-full">
                  <button onClick={() => handleNavClick('search')} className={linkBaseClasses}>Annonces</button>
                  <div className="relative h-full flex items-center" ref={techMenuRef}>
                      <button onClick={() => setIsTechMenuOpen(!isTechMenuOpen)} className={`flex items-center gap-1 ${linkBaseClasses}`}>
                          Fiches Techniques <ChevronDown size={14} className={`transition-transform duration-300 ${isTechMenuOpen ? 'rotate-180' : ''}`} strokeWidth={3} />
                      </button>
                      {isTechMenuOpen && (
                          <div className="absolute left-0 top-full mt-2 w-52 bg-card rounded-xl shadow-xl border border-gray-100 py-2 animate-fade-in-up origin-top-left overflow-hidden z-[110]">
                              <button onClick={() => handleNavClick('tech-specs-brands')} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors block">Fiches Techniques</button>
                              <button onClick={() => handleNavClick('comparator')} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors block border-t border-gray-50">Comparateur Expert</button>
                          </div>
                      )}
                  </div>
                  <div className="relative h-full flex items-center" ref={newsMenuRef}>
                      <button onClick={() => setIsNewsMenuOpen(!isNewsMenuOpen)} className={`flex items-center gap-1 ${linkBaseClasses}`}>
                          Actualités <ChevronDown size={14} className={`transition-transform duration-300 ${isNewsMenuOpen ? 'rotate-180' : ''}`} strokeWidth={3} />
                      </button>
                      {isNewsMenuOpen && (
                          <div className="absolute left-0 top-full mt-2 w-52 bg-card rounded-xl shadow-xl border border-gray-100 py-2 animate-fade-in-up origin-top-left overflow-hidden z-[110]">
                              <button onClick={() => handleNavClick('news')} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors block">Actualités & Essais</button>
                              <button onClick={() => handleNavClick('tips')} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors block border-t border-gray-50">Conseils & Guides</button>
                          </div>
                      )}
                  </div>
                  {/* Garages — temporarily hidden until launch */}
                </div>
                <div className={`h-6 w-px transition-colors duration-300 ${!isSolid ? 'bg-white/30' : 'bg-gray-200'}`}></div>
              </>
            )}

            {isAdminUser && (
              <span className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                isSolid ? 'bg-slate-900 text-white' : 'bg-white/15 text-white border border-white/25'
              }`}>
                <Settings size={12} /> Mode admin
              </span>
            )}

            <div className="flex items-center gap-4">
              {isLoggedIn ? (
                <>
                  {!isAdminUser && (
                    <>
                      <button onClick={() => handleNavClick('dashboard', { tab: 'messages' })} className={headerIconButtonClasses} aria-label="Messages" title="Messages">
                          <div className="relative">
                              <MessageSquare size={20} className={unreadMessagesCount > 0 ? "text-primary-600" : ""} />
                              {unreadMessagesCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm border-2 border-white">
                                  {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                                </span>
                              )}
                          </div>
                      </button>
                      <button onClick={() => handleNavClick('dashboard', { tab: 'favorites' })} className={headerIconButtonClasses} aria-label="Favoris">
                          <div className="relative">
                              <Heart size={20} className={favoritesCount > 0 ? "fill-current text-red-500" : ""} />
                              {favoritesCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary-600 text-white text-[12px] font-bold rounded-full flex items-center justify-center shadow-sm">{favoritesCount}</span>}
                          </div>
                      </button>
                    </>
                  )}
                  <div className="relative" ref={userMenuRef}>
                    <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className={`flex items-center gap-3 p-1 rounded-full transition-all focus:outline-none ${!isSolid ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                      <div className={`rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold shadow-md text-[12px] transition-all duration-300 ${isScrolled ? 'w-8 h-8' : 'w-9 h-9'}`}>{initials}</div>
                    </button>
                    {isUserMenuOpen && (
                      <div className="absolute right-0 top-full mt-3 w-64 bg-card rounded-2xl shadow-xl border border-gray-100 py-3 animate-fade-in-up origin-top-right z-[110] overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-50 mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center font-black text-sm shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-sm font-black text-gray-900 truncate">{displayName}</h4>
                                {isAdminUser && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary-600 text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                                    <Settings size={9} strokeWidth={3} /> {adminLabel}
                                  </span>
                                )}
                              </div>
                              {user?.email && (
                                <p className="text-[11px] text-gray-400 font-medium truncate">{user.email}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        {isAdminUser ? (
                          <button onClick={() => handleNavClick('admin')} className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                            <Settings size={16} className="text-gray-400" /> Admin
                          </button>
                        ) : (
                          <>
                            <button onClick={() => handleNavClick('dashboard', { tab: 'overview' })} className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                              <LayoutDashboard size={16} className="text-gray-400" /> Tableau de bord
                            </button>
                            <button onClick={() => handleNavClick('dashboard', { tab: 'messages' })} className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-3 transition-colors">
                              <span className="flex items-center gap-3"><MessageSquare size={16} className="text-gray-400" /> Messagerie</span>
                              {unreadMessagesCount > 0 && (
                                <span className="min-w-[20px] h-5 px-1.5 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                  {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                                </span>
                              )}
                            </button>
                            <button onClick={() => handleNavClick('dashboard', { tab: 'favorites' })} className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                              <Heart size={16} className="text-gray-400" /> Favoris
                            </button>
                          </>
                        )}
                        <div className="mx-4 my-2 border-t border-gray-50"></div>
                        <button onClick={() => { setIsUserMenuOpen(false); logout(); }} className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors">
                          <LogOut size={16} /> Se Déconnecter
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1">
                  <button onClick={triggerLogin} className={headerIconButtonClasses} title="Connexion"><LogIn size={20} /></button>
                  <button onClick={triggerLogin} className={headerIconButtonClasses} title="Inscription"><UserPlus size={20} /></button>
                </div>
              )}

              {/* Primary CTA — admins see "Console admin", others see "Déposer une annonce" */}
              {isAdminUser ? (
                <button
                  onClick={() => handleNavClick('admin')}
                  className={`flex items-center justify-center gap-2 px-6 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 ${
                    isScrolled ? 'h-9 px-5' : 'h-11'
                  } ${
                    !isScrolled && variant === 'transparent'
                      ? 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  <Settings className={isScrolled ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                  <span className="whitespace-nowrap">Console admin</span>
                </button>
              ) : currentView !== 'deposit' ? (
                <button
                  onClick={() => isLoggedIn ? handleNavClick('deposit') : triggerLogin()}
                  className={`flex items-center justify-center gap-2 px-6 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 ${
                    isScrolled ? 'h-9 px-5' : 'h-11'
                  } ${
                    !isScrolled && variant === 'transparent'
                      ? 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  }`}
                >
                  <Plus className={isScrolled ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                  <span className="whitespace-nowrap">Déposer une annonce</span>
                </button>
              ) : null}
            </div>
          </nav>

          <div className="lg:hidden flex items-center gap-2">
             {currentView !== 'deposit' && (
             <button
                onClick={() => isLoggedIn ? handleNavClick('deposit') : triggerLogin()}
                className={`flex items-center justify-center gap-1 h-[34px] max-[360px]:h-8 px-2.5 max-[360px]:px-2 rounded-lg text-[12px] max-[360px]:text-[11px] font-bold transition-all active:scale-95 ${
                  !isSolid
                    ? 'bg-white/10 hover:bg-white/20 border border-white/25 text-white backdrop-blur-sm'
                    : 'bg-primary-600 hover:bg-primary-700 text-white shadow-md'
                }`}
                aria-label="Déposer une annonce"
             >
                <Plus className="w-3.5 h-3.5 max-[360px]:w-3 max-[360px]:h-3" strokeWidth={3} />
                <span>Vendre</span>
             </button>
             )}
             <button 
                onClick={() => setIsMobileSheetOpen(true)}
                className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all group active:scale-90 ${
                  !isSolid ? 'text-white' : 'text-gray-900 bg-gray-50'
                }`}
                aria-label="Ouvrir le menu"
             >
                <div className="w-6 h-[15px] flex flex-col justify-between items-end overflow-hidden">
                   <span className="w-6 h-[2px] bg-current rounded-full transition-all duration-300"></span>
                   <span className="w-4 h-[2px] bg-current rounded-full transition-all duration-300 group-hover:w-6"></span>
                   <span className="w-6 h-[2px] bg-current rounded-full transition-all duration-300"></span>
                </div>
             </button>
          </div>
        </div>
      </header>

      {isMobileSheetOpen && (
        <div 
          ref={mobileSheetRef}
          className="fixed inset-0 z-[200] bg-card flex flex-col h-[100dvh] w-screen overflow-hidden animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
             <button onClick={() => handleNavClick('home')} className="group">
               <img src={LOGO_COLOR} alt="moto-scoot.tn" width={373} height={48} className="h-6 w-auto object-contain transition-transform duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] group-hover:scale-105" />
             </button>
             <button 
               onClick={() => setIsMobileSheetOpen(false)}
               className="p-2 text-gray-500 hover:text-gray-900 bg-gray-50 rounded-full transition-colors active:scale-90"
             >
               <X size={24} strokeWidth={2.5} />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
            {/* "Mon Profil" pill — orange-tinted card matching reference */}
            <div className="px-5 pt-5 pb-2">
              {isLoggedIn ? (
                <button
                  onClick={() => handleNavClick(isAdminUser ? 'admin' : 'dashboard', isAdminUser ? undefined : { tab: 'overview' })}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-orange-50 border border-orange-100 active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={iconProfile} alt="" aria-hidden width={32} height={32} className="w-8 h-8 object-contain" />
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-[15px] font-black text-gray-900 truncate">{displayName || 'Mon Profil'}</span>
                      {isAdminUser ? (
                        <span className="text-[11px] text-primary-600 font-bold uppercase tracking-wider">{adminLabel}</span>
                      ) : (
                        <span className="text-[11px] text-gray-500 font-medium">{user?.memberType === 'Pro' ? 'Professionnel' : 'Particulier'}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setIsMobileSheetOpen(false); triggerLogin(); }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-3.5 rounded-2xl bg-orange-50 border border-orange-100 text-primary-700 font-black text-[14px] active:scale-[0.99] transition-transform"
                  >
                    <LogIn size={16} strokeWidth={2.5} />
                    Se connecter
                  </button>
                  <button
                    onClick={() => { setIsMobileSheetOpen(false); triggerLogin(); }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-3.5 rounded-2xl bg-primary-600 text-white font-black text-[14px] active:scale-[0.99] transition-transform shadow-sm"
                  >
                    <UserPlus size={16} strokeWidth={2.5} />
                    S'inscrire
                  </button>
                </div>
              )}
            </div>

            {/* Section: Tableau de bord */}
            {isLoggedIn && !isAdminUser && (
              <div className="mt-4">
                <span className="px-6 text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-1">Tableau de bord</span>
                <MenuLink image={iconDashboard} label="Tableau de bord" onClick={() => handleNavClick('dashboard', { tab: 'overview' })} />
                <MenuLink image={iconHeart} label="Mes Favoris" onClick={() => handleNavClick('dashboard', { tab: 'favorites' })} />
                <MenuLink image={iconMessages} label="Messagerie" badge={unreadMessagesCount > 0 ? (unreadMessagesCount > 99 ? '99+' : String(unreadMessagesCount)) : undefined} onClick={() => handleNavClick('dashboard', { tab: 'messages' })} />
              </div>
            )}

            {/* Section: Marché */}
            <div className="mt-4">
              <span className="px-6 text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-1">Marché</span>
              <MenuLink image={iconSearch} label="Acheter" onClick={() => handleNavClick('search')} />
              <MenuLink image={iconSell} label="Vendre" tag="Gratuit" variant="primary" onClick={() => isLoggedIn ? handleNavClick('deposit') : triggerLogin()} />
              <MenuLink image={iconSpecs} label="Fiches techniques" onClick={() => handleNavClick('tech-specs-brands')} />
              <MenuLink image={iconCompare} label="Comparateur" onClick={() => handleNavClick('comparator')} />
            </div>

            {/* Section: Services */}
            <div className="mt-4">
              <span className="px-6 text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-1">Services</span>
              {/* Garages — temporarily hidden until launch */}
              <MenuLink image={iconTips} label="Conseils et guides" onClick={() => handleNavClick('tips')} />
              <MenuLink image={iconNews} label="Actualités et essais" onClick={() => handleNavClick('news')} />
              {isAdminUser && <MenuLink image={iconAdmin} label="Administration" onClick={() => handleNavClick('admin')} />}
            </div>

            {/* Logout pill at bottom */}
            {isLoggedIn && (
              <div className="mt-6 px-5 pb-6">
                <button
                  onClick={() => { setIsMobileSheetOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-orange-50 border border-orange-100 active:scale-[0.99] transition-transform"
                >
                  <img src={iconLogout} alt="" aria-hidden width={28} height={28} className="w-7 h-7 object-contain" />
                  <span className="text-[15px] font-black text-primary-600">Se déconnecter</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Header;