import React, { useState, useEffect } from 'react';
import { LayoutDashboard, List, Settings, LogOut, TrendingUp, Eye, Phone, MessageSquare, ShieldCheck } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { useUserStats } from '../hooks/useUserStats';
import SEO from './common/SEO';

const S = {
  Wrapper: "min-h-screen bg-muted font-sans pb-12",
  // Container standardisé v2.1
  Container: "max-w-7xl mx-auto px-6 md:px-20 lg:px-32 pt-28 pb-8",
  Layout: "flex flex-col lg:flex-row gap-8",
  Sidebar: "w-full lg:w-72 flex-shrink-0",
  SidebarCard: "bg-card rounded-xl border border-gray-100 p-5 sticky top-28 shadow-sm space-y-6",
  SidebarHeader: "flex flex-col items-center p-4 border-b border-gray-50 pb-8",
  LogoBox: "w-24 h-24 rounded-2xl bg-gray-900 flex items-center justify-center text-white font-black text-3xl mb-4 border-4 border-white shadow-md",
  NavButton: (active: boolean) => `w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-bold transition-all ${active ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`,
  MainContent: "flex-1 min-w-0",
  StatGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8",
  StatCard: "bg-card p-5 rounded-lg border border-gray-100 shadow-sm flex flex-col justify-between h-36",
  SectionCard: "bg-card rounded-xl border border-gray-100 p-8 shadow-sm",
};

const DashboardPro: React.FC<any> = ({ initialTab = 'overview', onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'listings' | 'settings'>(initialTab);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);

  const { data: userStats } = useUserStats();
  const fmt = (n?: number) => (n == null ? '—' : n.toLocaleString('fr-FR'));
  const stats = [
    { label: 'Vues Boutique', value: fmt(userStats?.listings.total_views), icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Annonces Actives', value: fmt(userStats?.listings.active), icon: List, color: 'text-primary-600', bg: 'bg-primary-50' },
    { label: 'Contacts', value: fmt(userStats?.listings.total_contacts), icon: Phone, color: 'text-success-600', bg: 'bg-success-50' },
    { label: 'Messages', value: fmt(userStats?.conversations_count), icon: MessageSquare, color: 'text-warning-600', bg: 'bg-warning-50' },
  ];

  return (
    <div className={S.Wrapper}>
      <SEO title="Espace Pro" description="Espace professionnel MotoScoot — pilotez vos annonces, statistiques et messagerie." noIndex url="/espace-pro" />
      <main className={S.Container}>
        <div className={S.Layout}>
          <aside className={S.Sidebar}>
            <div className={S.SidebarCard}>
              <div className={S.SidebarHeader}>
                <div className={S.LogoBox}>TM</div>
                <h3 className="font-black text-gray-900 text-lg">Tunis Moto Shop</h3>
                <Badge variant="success" size="xs" className="mt-3" icon={<ShieldCheck size={12}/>}>VÉRIFIÉ</Badge>
              </div>
              <nav className="space-y-1.5">
                <button onClick={() => setActiveTab('overview')} className={S.NavButton(activeTab === 'overview')}><LayoutDashboard size={20} /> Performance</button>
                <button onClick={() => setActiveTab('listings')} className={S.NavButton(activeTab === 'listings')}><List size={20} /> Annonces</button>
                <button onClick={() => setActiveTab('settings')} className={S.NavButton(activeTab === 'settings')}><Settings size={20} /> Paramètres</button>
              </nav>
              <div className="pt-6 border-t border-gray-50"><Button variant="ghost" fullWidth onClick={onLogout} className="text-red-500" leftIcon={<LogOut size={18}/>}>Déconnexion</Button></div>
            </div>
          </aside>
          <div className={S.MainContent}>
            <h1 className="text-3xl font-black text-gray-900 mb-8 tracking-tight">{activeTab === 'overview' ? 'Performance Boutique' : activeTab === 'listings' ? 'Mes Annonces' : 'Paramètres'}</h1>
            {activeTab === 'overview' && (
               <div className="space-y-8 animate-fade-in-up">
                  <div className={S.StatGrid}>{stats.map((s, i) => (
                    <div key={i} className={S.StatCard}>
                      <div className="flex justify-between items-start"><div className={`p-2.5 rounded-lg ${s.bg} ${s.color}`}><s.icon size={20} /></div></div>
                      <div><h4 className="text-2xl font-extrabold text-gray-900">{s.value}</h4><p className="text-xs text-gray-400 font-bold uppercase">{s.label}</p></div>
                    </div>
                  ))}</div>
                  <div className={S.SectionCard}>
                    <div className="flex justify-between items-center mb-8"><h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><TrendingUp size={20} className="text-primary-600" /> Croissance</h3></div>
                    <div className="h-48 flex items-end justify-between gap-2 border-b border-gray-50">{[40, 65, 45, 80, 55, 90].map((h, i) => (<div key={i} className="w-full bg-primary-50 rounded-t-md relative"><div className="absolute bottom-0 left-0 right-0 bg-primary-600 rounded-t-md" style={{ height: `${h}%` }} /></div>))}</div>
                  </div>
               </div>
            )}
            {activeTab === 'settings' && (
                <div className={S.SectionCard}>
                    <h4 className="font-black text-xl mb-8">Profil Boutique</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><Input label="Enseigne" value="Tunis Moto Shop" /><Input label="Email" value="contact@tunismoto.tn" /></div>
                    <Button variant="primary" className="mt-8" onClick={() => setIsSaving(true)} isLoading={isSaving}>Sauvegarder</Button>
                </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPro;