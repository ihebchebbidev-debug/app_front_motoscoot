import React, { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Calendar, ThumbsUp, ThumbsDown, CheckCircle2, Wrench, Lightbulb, Share2, AlertTriangle, Home, ChevronRight } from 'lucide-react';
import { sanitizeRichHtml } from './admin/RichTextEditor';
import { useTip, useTips, useRelatedTips } from '../hooks/useTips';
import Header from './layout/Header';
import { Reveal } from './ui/Reveal';
import SEO from './common/SEO';
import AdBanner from './common/AdBanner';
import SocialShareModal from './common/SocialShareModal';
import { getUrlFromState } from '../utils/urlUtils';
import { Button } from './ui/Button';

interface TipDetailsProps {
  tipId: number | string;
  onGoHome?: () => void;
  onNavigate?: (view: string, params?: any) => void;
  onBack?: () => void;
}

const TipDetails: React.FC<TipDetailsProps> = ({ tipId, onNavigate, onBack }) => {
  const [helpful, setHelpful] = useState<'yes' | 'no' | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const { data: fetchedTip, isLoading: tipLoading, error: tipError, refetch: reloadTip } = useTip(tipId);
  const { data: allTips = [] } = useTips();
  const { data: fetchedRelated = [] } = useRelatedTips(tipId);
  const tip = fetchedTip || allTips.find((t) => String(t.id) === String(tipId));

  // Hooks must run before any early return (the old order crashed the page
  // on a cold load once the guide finished loading).
  useEffect(() => { 
    window.scrollTo(0, 0); 
    setHelpful(null); 

    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = totalHeight > 0 ? Math.min(100, Math.max(0, window.scrollY / totalHeight * 100)) : 0;
      setReadingProgress(progress);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [tipId]);

  if (!tip && tipLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-muted text-gray-500 text-sm">Chargement…</div>;
  }

  if (!tip) {
    if (tipError && (tipError as { status?: number }).status !== 404) return <div className="min-h-screen flex flex-col gap-4 items-center justify-center"><p role="alert">Le guide est momentanément indisponible.</p><Button onClick={() => reloadTip()}>Réessayer</Button></div>;
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted text-center px-6">
        <div>
          <SEO title="Astuce introuvable" description="Cette astuce n'existe pas ou n'est plus disponible." noIndex />
          <h1 className="text-2xl font-black text-gray-900 mb-2">Astuce introuvable</h1>
          <p className="text-gray-500 text-sm">Cette astuce n'existe pas ou n'est plus disponible.</p>
        </div>
      </div>
    );
  }



  const handleShare = () => {
    setShareOpen(true);
  };

  const getDifficultyColor = (diff: string) => {
      switch(diff) {
          case 'Débutant': return 'text-green-700 bg-green-50 border-green-100';
          case 'Intermédiaire': return 'text-yellow-700 bg-yellow-50 border-yellow-100';
          case 'Expert': return 'text-red-700 bg-red-50 border-red-100';
          default: return 'text-gray-700 bg-gray-50 border-gray-100';
      }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F9] md:bg-card font-sans pb-0">
      <SEO 
        title={tip.title} 
        description={tip.summary} 
        image={tip.image} 
        url={getUrlFromState('tip-details', { id: tip.id, title: tip.title })}
        type="article"
        publishedTime={(tip as any).publishedAt || (tip as any).published_at || (tip as any).createdAt}
        modifiedTime={(tip as any).updatedAt || (tip as any).updated_at}
        schema={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: tip.title,
          url: `https://www.moto-scoot.tn${getUrlFromState('tip-details', { id: tip.id, title: tip.title })}`,
          description: tip.summary,
          image: tip.image ? [tip.image] : undefined,
          datePublished: (tip as any).publishedAt || (tip as any).published_at || (tip as any).createdAt,
          dateModified: (tip as any).updatedAt || (tip as any).updated_at,
          author: { "@type": "Organization", name: "moto-scoot.tn" },
          publisher: {
            "@type": "Organization",
            name: "moto-scoot.tn",
            logo: { "@type": "ImageObject", url: "https://www.moto-scoot.tn/site-logo/logo-color.svg" },
          },
        }}
      />
      
      {/* Barre de progression de lecture fine */}
      <div className="fixed top-0 left-0 w-full h-[3px] z-[110] bg-gray-50">
        <div 
          className="h-full bg-primary-600 transition-all duration-150 ease-out shadow-[0_0_8px_rgba(230,81,0,0.5)]"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <div className="pt-4 md:pt-8">
        {/* Header Section */}
        <header className="max-w-7xl mx-auto px-4 md:px-6 mb-6 md:mb-8">
            <Reveal animation="fade-in-up">
              <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                <button onClick={onBack} className="p-1.5 md:p-2 bg-card border border-gray-100 rounded-lg md:rounded-xl text-gray-700 hover:text-primary-600 shadow-sm transition-all active:scale-95" aria-label="Retour"><ArrowLeft size={16} className="md:w-5 md:h-5"/></button>
                <nav className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-[13px] font-medium text-gray-400">
                  <span className="flex items-center gap-1 hover:text-primary-600 cursor-pointer" onClick={() => onNavigate?.('home')}>
                    <Home size={12} className="md:w-3.5 md:h-3.5" /> Accueil
                  </span>
                  <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                  <span className="hover:text-primary-600 cursor-pointer" onClick={() => onNavigate?.('tips')}>Conseils</span>
                  <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                  <span className="text-gray-900 font-extrabold truncate max-w-[150px] md:max-w-none">{tip.title}</span>
                </nav>
              </div>

              {/* Titre Mobile */}
              <div className="md:hidden text-[2rem] font-[900] text-gray-900 leading-[1.15] tracking-[-0.03em] mb-4">
                {tip.title}
              </div>
              {/* Titre Desktop */}
              <h1 className="hidden md:block text-[3.5rem] font-[900] text-gray-900 leading-[1.1] tracking-[-0.03em] mb-6">
                {tip.title}
              </h1>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 font-bold uppercase">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-primary-600 font-black text-[10px]">{tip.author.charAt(0)}</div>
                    <span className="text-gray-900">{tip.author}</span>
                  </div>
                  <div className="flex items-center gap-1.5"><Clock size={14} /><span>{tip.readTime}</span></div>
                  <div className="flex items-center gap-1.5"><Calendar size={14} /><span>{tip.date}</span></div>
                  <button
                    onClick={handleShare}
                    className="ml-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-card border border-gray-200 text-gray-700 hover:border-primary-600 hover:text-primary-600 transition-all text-[11px] font-extrabold uppercase tracking-wider shadow-sm active:scale-95"
                  >
                    <Share2 size={14} /> Partager
                  </button>
              </div>
            </Reveal>
        </header>

        {/* Featured Image */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 mb-8 md:mb-12">
            <Reveal animation="scale-in">
              <div className="relative aspect-[16/10] md:aspect-[21/9] rounded-2xl md:rounded-3xl overflow-hidden bg-gray-100">
                  <img 
                    src={tip.image} 
                    alt={tip.title} 
                    className="w-full h-full object-cover"
                  />
              </div>
            </Reveal>
        </div>

        {/* Article Core Content */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 pb-16">
            
            {/* Main Column */}
            <article className="lg:col-span-8 lg:col-start-1">
                {/* Summary */}
                <Reveal animation="fade-in-up">
                  <div className="bg-card rounded-2xl p-6 md:p-8 border border-gray-200 mb-8 md:mb-10">
                      <p className="text-lg md:text-xl text-gray-800 leading-relaxed font-medium italic">{tip.summary}</p>
                  </div>
                </Reveal>

                {/* Content */}
                <Reveal animation="fade-in-up">
                  <div className="prose prose-lg prose-slate max-w-none mb-12" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(tip.content || "") }} />
                </Reveal>

                {/* Feedback */}
                <Reveal animation="fade-in-up">
                  <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8 text-center mb-8">
                     <h3 className="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider">Ce guide vous a-t-il été utile ?</h3>
                     <div className="flex justify-center gap-4">
                        <button onClick={() => setHelpful('yes')} className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all border uppercase text-xs ${helpful === 'yes' ? 'bg-card text-gray-900 border-gray-300 shadow-sm' : 'bg-card text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900'}`}><ThumbsUp size={16} /> Oui</button>
                        <button onClick={() => setHelpful('no')} className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all border uppercase text-xs ${helpful === 'no' ? 'bg-card text-gray-900 border-gray-300 shadow-sm' : 'bg-card text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900'}`}><ThumbsDown size={16} /> Non</button>
                     </div>
                  </div>
                </Reveal>
            </article>

            {/* Sidebar */}
            <aside className="lg:col-span-4 space-y-6">
               <div className="sticky top-28 space-y-6">
                  {/* Matériel Requis */}
                  <div className="bg-card rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                     <div className="bg-brand-youtube px-6 py-4 flex items-center gap-3">
                        <Wrench className="text-white" size={18} />
                        <h3 className="font-bold text-white text-sm uppercase tracking-wider">Matériel Requis</h3>
                     </div>
                     <div className="p-6">
                        <ul className="space-y-4">
                           {tip.tools?.map((tool, idx) => (
                              <li key={idx} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full border-2 border-orange-100 flex items-center justify-center shrink-0">
                                  <div className="w-2 h-2 rounded-full bg-primary-600"></div>
                                </div>
                                <span className="text-gray-700 font-medium text-sm">{tool}</span>
                              </li>
                           ))}
                        </ul>
                     </div>
                  </div>
                  
                  {/* En Bref */}
                  <div className="bg-card rounded-2xl border border-gray-200 shadow-sm p-6">
                     <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2 uppercase text-xs tracking-widest">
                        <Lightbulb className="text-warning-500" size={16} /> En bref
                     </h3>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                          <span className="text-gray-500 text-[11px] font-bold uppercase">Difficulté</span>
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${getDifficultyColor(tip.difficulty)}`}>{tip.difficulty}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                          <span className="text-gray-500 text-[11px] font-bold uppercase">Temps</span>
                          <span className="font-black text-gray-900 text-xs">{tip.readTime}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-[11px] font-bold uppercase">Catégorie</span>
                          <span className="font-black text-gray-900 text-xs uppercase">{tip.category}</span>
                        </div>
                     </div>
                  </div>

                  {/* Publicité Sidebar - Format Carré (cohérent avec les autres pages) */}
                  <AdBanner
                    zone="listing_sidebar"
                    variant="banner"
                    className="aspect-square w-full rounded-[24px] border border-gray-100 shadow-sm overflow-hidden"
                  />
                  
                  {/* Warning */}
                  <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100 flex gap-3">
                    <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] text-orange-900 font-bold uppercase leading-relaxed">Note : La mécanique moto comporte des risques. En cas de doute, consultez un professionnel certifié.</p>
                  </div>
               </div>
            </aside>
        </div>

        {/* Related Tips */}
        <div className="bg-gray-50 py-16 border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tight mb-8">À consulter également</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(fetchedRelated.length ? fetchedRelated : allTips.filter(t => t.id !== tip.id)).slice(0, 3).map((relatedTip) => (
                <div key={relatedTip.id} className="bg-card rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => onNavigate?.('tip-details', { id: relatedTip.id })}>
                  <div className="aspect-[16/10] relative overflow-hidden">
                    <img src={relatedTip.image} alt={relatedTip.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-gray-900">
                      {relatedTip.category}
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full ${relatedTip.difficulty === 'Débutant' ? 'bg-green-500' : relatedTip.difficulty === 'Intermédiaire' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{relatedTip.difficulty}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">{relatedTip.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4">{relatedTip.summary}</p>
                    <span className="text-primary-600 text-xs font-bold uppercase tracking-wider flex items-center gap-1 group-hover:gap-2 transition-all">
                      Lire la suite <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      <SocialShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        content={{
          kind: 'tip',
          id: tip.id,
          title: tip.title,
          subtitle: (tip as any).category,
          summary: tip.summary,
          image: tip.image,
          tags: [(tip as any).category, (tip as any).difficulty].filter(Boolean) as string[],
        }}
      />
    </div>
  );
};

export default TipDetails;