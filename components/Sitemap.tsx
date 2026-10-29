import React from 'react';
import { Home, ChevronRight, ShoppingBag, Wrench, FileText, User, ArrowLeft } from 'lucide-react';

const SitemapSection = ({ title, icon: Icon, links, onNavigate }: any) => (
    <div className="bg-card rounded-3xl border border-gray-100 p-8 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"><Icon size={20} /></div><h3 className="text-xl font-bold text-gray-900">{title}</h3></div>
        <ul className="space-y-3">{links.map((link: any, idx: number) => (<li key={idx}><button onClick={() => onNavigate?.(link.view, link.params)} className="text-gray-500 hover:text-primary-600 font-medium text-sm flex items-center gap-2 transition-colors group"><ChevronRight size={14} className="text-gray-300 group-hover:text-primary-400" />{link.label}</button></li>))}</ul>
    </div>
);

const Sitemap: React.FC<any> = ({ onGoHome, onNavigate }) => {
  const sections = [
    { title: "Marché", icon: ShoppingBag, links: [{ label: "Accueil", view: "home" }, { label: "Annonces", view: "search" }, { label: "Vendre", view: "deposit" }] },
    { title: "Services", icon: Wrench, links: [{ label: "Garages", view: "garages" }, { label: "Contact Pro", view: "contact" }] },
    { title: "Infos", icon: FileText, links: [{ label: "Actus", view: "news" }, { label: "Conseils", view: "tips" }, { label: "Fiches Tech", view: "tech-specs-brands" }, { label: "FAQ", view: "faq" }] },
    { title: "Profil", icon: User, links: [{ label: "Dashboard", view: "dashboard" }, { label: "Favoris", view: "favorites" }] }
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16">
      <div className="relative w-full h-[35vh] md:h-[30vh] lg:h-[45vh] flex flex-col md:items-center md:justify-center px-6 font-sans overflow-hidden bg-primary-50">
        <div className="absolute inset-0 overflow-hidden z-0"><div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://www.moto-scoot.tn/hero-assets/-hero-background.webp')" }} /><div className="absolute inset-0 bg-gradient-to-b from-primary-700 to-primary-600 opacity-95 mix-blend-multiply" /></div>
        <div className="relative z-10 flex flex-col justify-center items-center w-full max-w-7xl mx-auto h-full pt-20">
          <div className="text-center px-4 md:mt-32"><h1 className="text-3xl md:text-6xl font-extrabold text-white mb-4 animate-fade-in-up">Plan du site</h1></div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32 py-12 md:py-16">
        <header className="flex items-center justify-between mb-8 md:mb-12">
           <div className="flex items-center gap-3 md:gap-4">
              <button onClick={onGoHome} className="p-1.5 md:p-2 bg-card border border-gray-100 rounded-lg md:rounded-xl text-gray-700 hover:text-primary-600 shadow-sm transition-all active:scale-95" aria-label="Retour"><ArrowLeft size={16} className="md:w-5 md:h-5"/></button>
              <nav className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-[13px] font-medium text-gray-400">
                 <span className="flex items-center gap-1 hover:text-primary-600 cursor-pointer" onClick={onGoHome}>
                   <Home size={12} className="md:w-3.5 md:h-3.5" /> Accueil
                 </span>
                 <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                 <span className="text-gray-900 font-extrabold truncate max-w-[100px] md:max-w-none">Plan du site</span>
              </nav>
           </div>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {sections.map((section, idx) => (<div key={idx} className="animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}><SitemapSection title={section.title} icon={section.icon} links={section.links} onNavigate={onNavigate} /></div>))}
        </div>
      </div>
    </div>
  );
};

export default Sitemap;