import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Store,
  LogOut,
  MessageSquareQuote,
  ShieldAlert,
  Megaphone,
  HelpCircle,
  Mail,
  Send,
  Database,
  Menu,
  X,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Globe2,
  ChevronRight,
  RefreshCw,
  Newspaper,
  Wrench,
  Lightbulb,
  Image as ImageIcon,
  Building2,
  Code2,
  Sparkles,
} from 'lucide-react';
import { BasePageProps } from '../../types';
import { useAdminStats } from '../../hooks/useAdmin';
import { useUser } from '../../context/UserContext';
import { tokenStorage } from '../../services/apiClient';
import OverviewTab from './OverviewTab';
import ListingsTab from './ListingsTab';
import UsersTab from './UsersTab';
import SiteReviewsTab from './SiteReviewsTab';
import GaragesTab from './GaragesTab';
import ReportsTab from './ReportsTab';
import AdsTab from './AdsTab';
import FaqTab from './FaqTab';
import ContactMessagesTab from './ContactMessagesTab';
import NewsletterTab from './NewsletterTab';
import ReferenceTab from './ReferenceTab';
import AudienceTab from './AudienceTab';
import ArticlesTab from './ArticlesTab';
import TipsTab from './TipsTab';
import TechSpecsTab from './TechSpecsTab';
import ImportersTab from './ImportersTab';
import AppearanceTab from './AppearanceTab';
import DeveloperTab from './DeveloperTab';
import SeoTab from './SeoTab';

type TabKey =
  | 'overview' | 'audience' | 'ads' | 'users' | 'reviews' | 'garages' | 'reports'
  | 'ad-campaigns' | 'faq' | 'contact' | 'newsletter' | 'reference'
  | 'articles' | 'tips' | 'tech-specs' | 'importers' | 'appearance' | 'seo' | 'developer';

interface NavItem {
  key: TabKey;
  label: string;
  icon: typeof Users;
  badge?: number;
  description?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const SuperAdminDashboard: React.FC<BasePageProps> = ({ onNavigate, onLogout, onTriggerLogin }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isLoading: userLoading } = useUser();
  const hasToken = !!tokenStorage.get();

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useAdminStats();
  const statsErrStatus = (statsError as any)?.status;
  const isAdmin = !!stats && !statsError;
  const isForbidden = statsErrStatus === 403;
  const isUnauth = statsErrStatus === 401 || !hasToken;

  useEffect(() => { setMobileOpen(false); }, [activeTab]);

  /* ============================================================
   * GATE 1 — Not logged in
   * ============================================================ */
  if (isUnauth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 pt-[100px]">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-4">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Connexion requise</h1>
          <p className="text-sm text-slate-600 mb-6">
            Vous devez vous connecter avec un compte administrateur pour accéder à cet espace.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => onTriggerLogin?.()}
              className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
            >
              Se connecter
            </button>
            <button
              onClick={() => onNavigate?.('home')}
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 pt-[100px]">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-4">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Accès refusé</h1>
          <p className="text-sm text-slate-600 mb-1">
            Le compte <strong>{user?.email}</strong> n'a pas les droits d'administrateur.
          </p>
          <p className="text-xs text-slate-500 mb-6">
            Demandez à un super-administrateur de vous attribuer le rôle <code className="font-mono">admin</code>.
          </p>
          <button
            onClick={() => onNavigate?.('home')}
            className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (statsLoading || userLoading || (!isAdmin && !statsError)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center pt-[72px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Vérification des droits administrateur…</p>
        </div>
      </div>
    );
  }

  if (statsError && !isForbidden && !isUnauth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 pt-[100px]">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-4">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-xl font-black text-slate-900 mb-2">Backend indisponible</h1>
          <p className="text-sm text-slate-600 mb-1 break-all font-mono">
            HTTP {statsErrStatus || 'N/A'} — {(statsError as any)?.message}
          </p>
          {(statsError as any)?.requestId && (
            <p className="text-xs text-slate-400 mb-6 font-mono">req: {(statsError as any).requestId}</p>
          )}
          <button
            onClick={() => refetchStats()}
            className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  /* ============================================================
   * Authenticated admin view
   * ============================================================ */

  const navSections: NavSection[] = [
    {
      title: 'Pilotage',
      items: [
        { key: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard, description: 'KPIs et activité récente' },
        { key: 'audience', label: 'Audience', icon: Globe2, description: 'Visiteurs et trafic' },
      ],
    },
    {
      title: 'Modération',
      items: [
        { key: 'ads', label: 'Annonces', icon: FileText, badge: stats?.listings.pending },
        { key: 'users', label: 'Utilisateurs', icon: Users },
        { key: 'reviews', label: 'Avis clients', icon: MessageSquareQuote },
        { key: 'garages', label: 'Garages Pro', icon: Store },
        { key: 'reports', label: 'Signalements', icon: ShieldAlert, badge: stats?.reports.unresolved },
      ],
    },
    {
      title: 'Contenu',
      items: [
        { key: 'articles', label: 'Actualités', icon: Newspaper, description: 'Gérer les articles & images' },
        { key: 'tips', label: 'Conseils', icon: Lightbulb, description: 'Guides & astuces (matériel, difficulté…)' },
        { key: 'tech-specs', label: 'Fiches techniques', icon: Wrench, description: 'Catalogue moto / scooter' },
        { key: 'importers', label: 'Importateurs', icon: Building2, description: 'Distributeurs assignés aux fiches' },
        { key: 'ad-campaigns', label: 'Publicités', icon: Megaphone },
        { key: 'faq', label: 'FAQ', icon: HelpCircle },
        { key: 'contact', label: 'Messages', icon: Mail },
        { key: 'newsletter', label: 'Newsletter', icon: Send },
      ],
    },
    {
      title: 'Système',
      items: [
        { key: 'appearance', label: 'Apparence', icon: ImageIcon, description: 'Image du hero (desktop & mobile)' },
        { key: 'seo', label: 'SEO & Analytics', icon: Sparkles, description: 'Méta, GA4, Search Console' },
        { key: 'reference', label: 'Données réf.', icon: Database },
        { key: 'developer', label: 'Développeur', icon: Code2, description: 'Tickets bugs / améliorations envoyés au dev' },
      ],
    },
  ];

  const allItems = navSections.flatMap((s) => s.items);
  const activeItem = allItems.find((i) => i.key === activeTab);
  const activeSection = navSections.find((s) => s.items.some((i) => i.key === activeTab));

  const SidebarContent = () => (
    <>
      {/* Brand / identity — matches app header gradient (primary-500 → primary-700) */}
      <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center shadow-md shadow-primary-200">
            <ShieldCheck size={20} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-black text-slate-900 leading-tight tracking-tight">Admin Console</div>
            <div className="text-[11px] text-slate-500 truncate font-medium">{user?.email || '—'}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            <div className="px-3 mb-1.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.14em]">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <item.icon size={16} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span className={`min-w-[20px] text-center py-0.5 px-1.5 rounded-full text-[10px] font-black ${
                        isActive ? 'bg-white/25 text-white' : 'bg-primary-100 text-primary-700'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-100 flex-shrink-0 space-y-1">
        <button
          onClick={() => onNavigate?.('home')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Globe2 size={16} /> Voir le site public
        </button>
        <button
          onClick={() => {
            if (onLogout) onLogout();
            if (onNavigate) onNavigate('home');
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={16} /> Quitter l'admin
        </button>
      </div>
    </>
  );

  return (
    <div className="h-[100dvh] bg-slate-50 flex overflow-hidden">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 px-3 py-2.5 flex items-center justify-between" style={{ paddingTop: 'calc(0.625rem + env(safe-area-inset-top))' }}>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg hover:bg-slate-100 -ml-1"
          aria-label="Ouvrir le menu admin"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck size={16} className="text-slate-700" />
          <span className="text-sm font-bold text-slate-900 truncate">{activeItem?.label}</span>
        </div>
        <button
          onClick={() => refetchStats()}
          disabled={statsLoading}
          className="p-2 rounded-lg hover:bg-slate-100 -mr-1 text-slate-500"
          aria-label="Actualiser"
        >
          <RefreshCw size={16} className={statsLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-slate-200 fixed top-0 h-[100dvh] z-50 transition-transform duration-200 flex flex-col w-[85vw] max-w-xs md:w-64 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="md:hidden p-3 flex items-center justify-end border-b border-slate-100 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-100"
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        </div>
        <SidebarContent />
      </aside>

      <main className="flex-1 md:ml-64 w-full overflow-y-auto overflow-x-hidden pt-[56px] md:pt-0">
        {/* Page header — desktop only (mobile uses top bar) */}
        <div className="hidden md:block bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="px-8 py-5 max-w-[1600px] mx-auto">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mb-1.5">
              <span>Admin</span>
              <ChevronRight size={12} />
              <span>{activeSection?.title}</span>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{activeItem?.label}</h1>
                {activeItem?.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{activeItem.description}</p>
                )}
              </div>

              {/* Compact live KPI strip — visible across all admin tabs */}
              {stats && (
                <div className="flex items-center gap-2">
                  <HeaderKpi
                    icon={FileText}
                    label="En attente"
                    value={stats.listings.pending}
                    tone={stats.listings.pending > 0 ? 'orange' : 'slate'}
                    onClick={() => setActiveTab('ads')}
                  />
                  <HeaderKpi
                    icon={ShieldAlert}
                    label="Signalements"
                    value={stats.reports.unresolved}
                    tone={stats.reports.unresolved > 0 ? 'red' : 'slate'}
                    onClick={() => setActiveTab('reports')}
                  />
                  <HeaderKpi
                    icon={Users}
                    label="Utilisateurs"
                    value={stats.users.total}
                    tone="slate"
                    onClick={() => setActiveTab('users')}
                  />
                  <button
                    onClick={() => refetchStats()}
                    disabled={statsLoading}
                    className="ml-1 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-900 disabled:opacity-60 transition-colors"
                    aria-label="Actualiser les statistiques"
                    title="Actualiser"
                  >
                    <RefreshCw size={14} className={statsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-3 md:p-8 max-w-[1600px] mx-auto pb-[env(safe-area-inset-bottom)]">
          {activeTab === 'overview'     && <OverviewTab />}
          {activeTab === 'audience'     && <AudienceTab />}
          {activeTab === 'ads'          && <ListingsTab onPreview={(id) => onNavigate?.('listing-details', { id })} />}
          {activeTab === 'users'        && <UsersTab />}
          {activeTab === 'reviews'      && <SiteReviewsTab />}
          {activeTab === 'garages'      && <GaragesTab />}
          {activeTab === 'reports'      && <ReportsTab />}
          {activeTab === 'articles'     && <ArticlesTab />}
          {activeTab === 'tips'         && <TipsTab />}
          {activeTab === 'tech-specs'   && <TechSpecsTab />}
          {activeTab === 'importers'    && <ImportersTab />}
          {activeTab === 'ad-campaigns' && <AdsTab />}
          {activeTab === 'faq'          && <FaqTab />}
          {activeTab === 'contact'      && <ContactMessagesTab />}
          {activeTab === 'newsletter'   && <NewsletterTab />}
          {activeTab === 'reference'    && <ReferenceTab />}
          {activeTab === 'appearance'   && <AppearanceTab />}
          {activeTab === 'seo'          && <SeoTab />}
          {activeTab === 'developer'    && <DeveloperTab />}
        </div>
      </main>
    </div>
  );
};

const HeaderKpi: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  tone: 'orange' | 'red' | 'slate';
  onClick?: () => void;
}> = ({ icon: Icon, label, value, tone, onClick }) => {
  const tones = {
    orange: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100',
    red:    'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
    slate:  'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  } as const;
  const valueTone = {
    orange: 'text-orange-700',
    red:    'text-red-700',
    slate:  'text-slate-900',
  } as const;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-lg border text-[12px] font-bold transition-colors ${tones[tone]}`}
    >
      <Icon size={13} />
      <span className="text-slate-500 font-semibold">{label}</span>
      <span className={`tabular-nums ${valueTone[tone]}`}>{value.toLocaleString('fr-FR')}</span>
    </button>
  );
};

export default SuperAdminDashboard;
