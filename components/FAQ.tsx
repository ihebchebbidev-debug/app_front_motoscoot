import React, { useMemo, useState } from 'react';
import { 
  Home, 
  ChevronRight, 
  Search, 
  HelpCircle, 
  ShoppingBag, 
  ShieldCheck, 
  Wrench,
  Zap,
  MessageCircle,
  Plus,
  ArrowLeft
} from 'lucide-react';
import { useFaq } from '../hooks/useFaq';
import { Skeleton } from './ui/Skeleton';
import SEO from './common/SEO';

interface FAQProps {
  onGoHome?: () => void;
  onNavigate?: (view: any, params?: any) => void;
}

const FAQ: React.FC<FAQProps> = ({ onGoHome, onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const { data: faqData = [], isLoading } = useFaq();

  // Categories derive from server data; "Tous" is always first.
  const categories = useMemo(() => {
    const set = new Set<string>();
    faqData.forEach((f) => f.category && set.add(f.category));
    return ['Tous', ...Array.from(set)];
  }, [faqData]);

  const filteredFaqs = faqData.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "Tous" || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleAccordion = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const getCategoryIcon = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('achet')) return <ShoppingBag size={18} />;
    if (c.includes('vend')) return <Zap size={18} />;
    if (c.includes('garage')) return <Wrench size={18} />;
    if (c.includes('sécur') || c.includes('secur')) return <ShieldCheck size={18} />;
    return <HelpCircle size={18} />;
  };

  // FAQPage rich-result schema (boosts Google's "People also ask" surface).
  const faqSchema = useMemo(() => {
    if (!faqData || faqData.length === 0) return undefined;
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqData.slice(0, 30).map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    };
  }, [faqData]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      <SEO
        title="FAQ moto-scoot.tn — Questions Fréquentes sur l'Achat & Vente de Motos"
        description="Toutes les réponses à vos questions sur l'achat, la vente, la sécurité et les paiements de motos d'occasion en Tunisie sur moto-scoot.tn."
        url="/faq"
        keywords={['FAQ moto Tunisie', 'questions achat moto', 'vente moto sécurité']}
        schema={faqSchema}
        breadcrumbs={[
          { name: 'Accueil', url: '/' },
          { name: 'FAQ', url: '/faq' },
        ]}
      />
      <div className="relative w-full h-[35vh] md:h-[30vh] lg:h-[45vh] flex flex-col md:items-center md:justify-center px-6 font-sans overflow-hidden bg-primary-50">
        <div className="absolute inset-0 overflow-hidden z-0">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://www.moto-scoot.tn/hero-assets/-hero-background.webp')" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-primary-700 to-primary-600 opacity-95 mix-blend-multiply" />
        </div>

        <div className="relative z-10 flex flex-col justify-center items-center w-full max-w-7xl mx-auto h-full pt-12">
          <div className="text-center px-4">
            <h1 className="text-3xl md:text-6xl font-extrabold text-white mb-4 drop-shadow-sm tracking-tight leading-tight animate-fade-in-up">
              Foire Aux Questions
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <header className="flex items-center justify-between">
             <div className="flex items-center gap-3 md:gap-4">
                <button onClick={onGoHome} className="p-1.5 md:p-2 bg-card border border-gray-100 rounded-lg md:rounded-xl text-gray-700 hover:text-primary-600 shadow-sm transition-all active:scale-95" aria-label="Retour"><ArrowLeft size={16} className="md:w-5 md:h-5"/></button>
                <nav className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-[13px] font-medium text-gray-400">
                   <span className="flex items-center gap-1 hover:text-primary-600 cursor-pointer" onClick={onGoHome}>
                     <Home size={12} className="md:w-3.5 md:h-3.5" /> Accueil
                   </span>
                   <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                   <span className="text-gray-900 font-extrabold truncate max-w-[100px] md:max-w-none">FAQ</span>
                </nav>
             </div>
          </header>
          <div className="relative w-full md:w-80">
             <input type="text" placeholder="Chercher une réponse..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-card text-sm outline-none" />
             <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" size={16} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <aside className="lg:col-span-3">
             <div className="bg-card rounded-3xl border border-gray-100 p-4 sticky top-24 shadow-sm">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 px-4">Catégories</h3>
                <nav className="space-y-1">
                   {categories.map((cat) => (
                     <button key={cat} onClick={() => setActiveCategory(cat)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${activeCategory === cat ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                        {getCategoryIcon(cat)} {cat}
                     </button>
                   ))}
                </nav>
             </div>
          </aside>

          <div className="lg:col-span-9 space-y-4">
             {isLoading && faqData.length === 0 && (
               Array.from({ length: 4 }).map((_, i) => (
                 <Skeleton key={i} className="h-20 rounded-3xl border border-gray-100" />
               ))
             )}
             {!isLoading && filteredFaqs.length === 0 && (
               <div className="bg-card rounded-3xl border border-gray-100 p-8 text-center text-gray-400 font-medium">
                 Aucune question ne correspond à votre recherche.
               </div>
             )}
             {filteredFaqs.map((item, index) => (
               <div key={item.id ?? index} className={`bg-card rounded-3xl border transition-all ${expandedIndex === index ? 'border-primary-200 shadow-lg' : 'border-gray-100 shadow-sm'}`}>
                  <button onClick={() => toggleAccordion(index)} className="w-full flex items-center justify-between p-6 text-left focus:outline-none">
                     <span className="text-lg font-bold text-gray-900">{item.question}</span>
                     <Plus size={16} className={`${expandedIndex === index ? 'rotate-45' : ''} transition-transform`} />
                  </button>
                  {expandedIndex === index && (
                    <div className="px-6 pb-6 pt-0 animate-fade-in-up">
                       <p className="text-gray-600 leading-relaxed font-medium pl-4 border-l-2 border-primary-100">{item.answer}</p>
                    </div>
                  )}
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;