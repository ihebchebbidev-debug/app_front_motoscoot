import React, { useEffect, useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Share2, 
  Facebook, 
  Twitter, 
  Linkedin,
  Tag,
  ChevronRight,
  ArrowRight,
  ThumbsUp,
  MessageSquare,
  Search,
  CheckCircle2,
  XCircle,
  TrendingUp,
  User,
  UserCircle,
  X,
  Home
} from 'lucide-react';
import { sanitizeRichHtml } from './admin/RichTextEditor';
import Header from './layout/Header';
// Article fallbacks now come exclusively from the API (useArticles / useArticle).
import { useArticles, useArticle, useRelatedArticles } from '../hooks/useArticles';
import { BasePageProps } from '../types';
import SEO from './common/SEO';
import { Button } from './ui/Button';
import { Reveal } from './ui/Reveal';
import AdBanner from './common/AdBanner';
import SocialShareModal from './common/SocialShareModal';

interface ArticleDetailsProps extends BasePageProps {
  articleId: number;
}

/**
 * ArticleProseContent — isolated prose renderer.
 *
 * Memoized on the raw HTML so it only re-renders (and only re-sets innerHTML)
 * when the article body actually changes. Without this, parent re-renders
 * triggered by scroll progress recompute `sanitizeRichHtml(...)`, which
 * produces a new string identity each time and React replaces the iframe —
 * causing the embedded YouTube video to reload mid-watch.
 */
const ArticleProseContent = React.memo(({ html }: { html: string }) => {
  const sanitized = useMemo(() => sanitizeRichHtml(html), [html]);
  return (
    <div
      className="prose prose-lg md:prose-xl prose-slate max-w-none 
        prose-headings:font-black prose-headings:tracking-tight prose-headings:text-gray-900
        prose-h2:text-2xl md:prose-h2:text-4xl prose-h2:mt-12 prose-h2:mb-5
        prose-h3:text-xl md:prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-3
        prose-p:text-gray-600 prose-p:leading-[1.75] prose-p:mb-5 md:prose-p:mb-8
        prose-a:text-primary-600 prose-a:font-black prose-a:no-underline hover:prose-a:underline
        prose-img:rounded-[1rem] md:prose-img:rounded-[2rem] prose-img:shadow-lg prose-img:my-8
        prose-blockquote:border-l-[4px] prose-blockquote:border-primary-600 prose-blockquote:bg-gray-50 prose-blockquote:py-5 prose-blockquote:px-6 md:prose-blockquote:px-10 prose-blockquote:rounded-r-2xl prose-blockquote:italic prose-blockquote:text-gray-800 prose-blockquote:font-bold prose-blockquote:my-8"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
});
ArticleProseContent.displayName = 'ArticleProseContent';

const ArticleDetails: React.FC<ArticleDetailsProps> = ({ 
  articleId, 
  onNavigate, 
  onBack 
}) => {
  const [readingProgress, setReadingProgress] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  const { data: fetchedArticle } = useArticle(articleId);
  const { data: fetchedRelated } = useRelatedArticles(articleId);
  const { data: allArticles = [] } = useArticles();

  const article = useMemo(
    () => fetchedArticle || allArticles.find((a) => a.id === articleId) || null,
    [fetchedArticle, allArticles, articleId],
  );

  const relatedArticles = useMemo(
    () =>
      (fetchedRelated && fetchedRelated.length
        ? fetchedRelated
        : article
        ? allArticles.filter((a) => a.id !== article.id)
        : []
      ).slice(0, 3),
    [fetchedRelated, allArticles, article?.id],
  );

  useEffect(() => {
    window.scrollTo(0, 0);

    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setReadingProgress(progress);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [articleId]);

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-card text-center px-6">
        <Header variant="white" />
        <div>
          <SEO title="Article introuvable" description="Cette page n'existe pas ou n'est plus disponible." noIndex />
          <h1 className="text-2xl font-black text-gray-900 mb-2">Article introuvable</h1>
          <p className="text-gray-500 text-sm">Cet article n'existe pas ou n'est plus disponible.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9F9] md:bg-card font-sans pb-12">
      <SEO 
        title={article.title} 
        description={article.summary} 
        image={article.image} 
        url={`/article/${(article as any).slug || article.id}`}
        type="article"
        publishedTime={(article as any).publishedAt || (article as any).published_at || (article as any).createdAt}
        modifiedTime={(article as any).updatedAt || (article as any).updated_at}
        schema={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: article.title,
          description: article.summary,
          image: article.image ? [article.image] : undefined,
          datePublished: (article as any).publishedAt || (article as any).published_at || (article as any).createdAt,
          dateModified: (article as any).updatedAt || (article as any).updated_at || (article as any).publishedAt,
          author: { "@type": "Organization", name: (article as any).author || "moto-scoot.tn" },
          publisher: {
            "@type": "Organization",
            name: "moto-scoot.tn",
            logo: { "@type": "ImageObject", url: "https://www.moto-scoot.tn/site-logo/logo-color.svg" },
          },
          mainEntityOfPage: { "@type": "WebPage", "@id": `https://www.moto-scoot.tn/article/${(article as any).id}` },
        }}
      />
      
      <Header variant="white" />

      {/* Barre de progression de lecture fine */}
      <div className="fixed top-0 left-0 w-full h-[3px] z-[110] bg-gray-50">
        <div 
          className="h-full bg-primary-600 transition-all duration-150 ease-out shadow-[0_0_8px_rgba(230,81,0,0.5)]"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <div className="pt-4 md:pt-8">
        {/* Header Section */}
        <header className="max-w-7xl mx-auto px-4 md:px-6 mb-6 md:mb-10">
            <Reveal animation="fade-in-up">
              <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                <button 
                  onClick={onBack} 
                  className="p-1.5 md:p-2 bg-card border border-gray-100 rounded-lg md:rounded-xl text-gray-700 hover:text-primary-600 shadow-sm transition-all active:scale-95" 
                  aria-label="Retour"
                >
                  <ArrowLeft size={16} className="md:w-5 md:h-5"/>
                </button>
                <nav className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-[13px] font-medium text-gray-400">
                  <span className="flex items-center gap-1 hover:text-primary-600 cursor-pointer" onClick={() => onNavigate?.('home')}>
                    <Home size={12} className="md:w-3.5 md:h-3.5" /> Accueil
                  </span>
                  <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                  <span className="hover:text-primary-600 cursor-pointer" onClick={() => onNavigate?.('news')}>Mag'</span>
                  <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                  <span className="text-gray-900 font-extrabold truncate max-w-[150px] md:max-w-none">{article.title}</span>
                </nav>
              </div>

              {/* Titre Mobile */}
              <div className="md:hidden text-[2rem] font-[900] text-gray-900 leading-[1.15] tracking-[-0.03em] mb-6">
                {article.title}
              </div>
              {/* Titre Desktop */}
              <h1 className="hidden md:block text-[3.5rem] font-[900] text-gray-900 leading-[1.1] tracking-[-0.03em] mb-8">
                {article.title}
              </h1>
            </Reveal>
        </header>

        {/* Featured Image */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 mb-8 md:mb-16">
            <Reveal animation="scale-in">
              <div className="relative aspect-[16/9] md:aspect-[21/9] md:rounded-[2.5rem] overflow-hidden shadow-xl bg-gray-100">
                  <img 
                    src={article.image} 
                    alt={article.title} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
                  <div className="absolute bottom-4 left-6 md:bottom-8 md:left-8">
                     <span className="px-3 py-1.5 md:px-5 md:py-2 bg-primary-600 text-white text-[12px] md:text-[12px] font-black uppercase tracking-widest rounded-full shadow-lg">
                        Exclusivité MotoScoot
                     </span>
                  </div>
              </div>
            </Reveal>
        </div>

        {/* Article Core Content */}
        <div className="max-w-7xl mx-auto px-6 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-16">
            
            {/* Left Rail (Desktop) */}
            <div className="hidden lg:block lg:col-span-1 lg:col-start-1">
                <div className="sticky top-32 flex flex-col items-center gap-5">
                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] [writing-mode:vertical-lr] rotate-180 mb-2">Partager</span>
                    <button onClick={() => setShareOpen(true)} aria-label="Partager sur Facebook" className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-[#1877F2] hover:text-white transition-all shadow-sm active:scale-90">
                        <Facebook size={18} />
                    </button>
                    <button onClick={() => setShareOpen(true)} aria-label="Partager sur LinkedIn" className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-[#0A66C2] hover:text-white transition-all shadow-sm active:scale-90">
                        <Linkedin size={18} />
                    </button>
                    <button onClick={() => setShareOpen(true)} aria-label="Plus de partage" className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-primary-600 hover:text-white transition-all shadow-sm active:scale-90">
                        <Share2 size={18} />
                    </button>
                </div>
            </div>

            {/* Main Column */}
            <article className="lg:col-span-7 lg:col-start-2">
                {/* AI Summary */}
                <Reveal animation="fade-in-up">
                  <div className="bg-gray-50/80 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 border border-gray-100 mb-8 md:mb-12 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform pointer-events-none">
                          <TrendingUp size={120} className="text-gray-900" />
                      </div>
                      <h3 className="text-[12px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 md:mb-6 flex items-center gap-2">
                          <span className="w-6 h-[2px] bg-primary-600"></span>
                          L'essentiel du test
                      </h3>
                      <div className="space-y-4 relative z-10">
                          <p className="text-lg md:text-2xl text-gray-900 font-bold leading-snug md:leading-tight">
                            {article.summary}
                          </p>
                      </div>
                  </div>
                </Reveal>

                {/* Prose Content — isolated in a memoized component so scroll-driven
                    re-renders of the parent don't reset innerHTML and reload
                    embedded YouTube iframes. */}
                <ArticleProseContent html={article.content || "<p>Contenu en cours de rédaction...</p>"} />

                {/* Author Signature */}
                <div className="flex items-center gap-5 py-10 border-t border-gray-100 mt-16 group">
                    <div className="relative">
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gray-100 flex items-center justify-center text-primary-600 font-black text-base md:text-lg border-4 border-white shadow-md shrink-0 group-hover:scale-105 transition-transform duration-500">
                            {article.author.charAt(0)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-primary-600 text-white p-1 rounded-full shadow-md">
                            <CheckCircle2 size={12} strokeWidth={3} />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[12px] font-black text-primary-600 uppercase tracking-[0.25em] mb-1">Rédigé par</span>
                        <h4 className="font-black text-gray-900 text-base md:text-lg leading-none mb-1.5">{article.author}</h4>
                        <div className="flex items-center gap-3 text-[12px] md:text-xs text-gray-400 font-bold uppercase tracking-tight">
                            <span className="flex items-center gap-1.5"><Calendar size={13} /> {article.date}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                            <span className="flex items-center gap-1.5"><Clock size={13} /> {article.readTime} de lecture</span>
                        </div>
                    </div>
                </div>

                {/* Tags */}
                <div className="hidden md:flex flex-wrap gap-2 mt-4 pt-8 border-t border-gray-100/50">
                    {article.tags?.map(tag => (
                        <button key={tag} className="px-3.5 py-1.5 rounded-lg bg-gray-50 text-gray-400 text-[9px] font-black uppercase tracking-widest hover:bg-gray-900 hover:text-white transition-all">
                            #{tag}
                        </button>
                    ))}
                </div>
            </article>

            {/* Right Rail (Desktop Only) */}
            <aside className="hidden lg:block lg:col-span-4 space-y-8">
                <div className="sticky top-32 space-y-8">
                    {/* Publicité Sidebar - Format Square Rounded 24px */}
                    <AdBanner 
                      zone="listing_sidebar" 
                      variant="banner" 
                      className="aspect-square w-full rounded-[24px] border border-gray-100 shadow-sm overflow-hidden" 
                    />
                </div>
            </aside>
        </div>

        {/* Next Read Section */}
        <section className="bg-gray-50/50 mt-16 md:mt-24 py-16 md:py-24 border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-6 md:px-8">
                <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-10 md:mb-12 gap-4 text-left">
                    <div className="max-w-xl">
                        <div className="md:hidden text-2xl font-[900] text-gray-900 tracking-tight leading-none mb-3 italic">
                          Pour aller plus loin...
                        </div>
                        <h2 className="hidden md:block text-4xl font-[900] text-gray-900 tracking-tight leading-none mb-3 italic">
                          Pour aller plus loin...
                        </h2>
                        <p className="text-gray-400 font-bold text-sm md:text-base">D'autres scoops et tests de la rédaction.</p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => onNavigate?.('news')}
                      className="border-gray-200 rounded-xl px-6 h-12 font-black text-[12px]"
                      rightIcon={<ArrowRight size={16} />}
                    >
                        Tout le Mag
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    {relatedArticles.map((rel, idx) => (
                        <Reveal key={rel.id} animation="fade-in-up" delay={idx * 50}>
                            <div 
                              onClick={() => onNavigate?.('article-details', { id: rel.id, title: rel.title })}
                              className="bg-card rounded-[1.5rem] overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group h-full flex flex-col"
                            >
                                <div className="relative aspect-[16/10] overflow-hidden bg-card">
                                    <img src={rel.image} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" alt={rel.title} />
                                    <div className="absolute top-4 left-4">
                                        <span className="px-3 py-1 bg-card/95 backdrop-blur-sm text-[8px] font-black uppercase tracking-[0.1em] rounded-md shadow-sm">
                                            {rel.category}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-6 flex flex-col flex-1">
                                    <h3 className="text-lg font-black text-gray-900 mb-3 leading-snug group-hover:text-primary-600 transition-colors line-clamp-2">
                                        {rel.title}
                                    </h3>
                                    <div className="mt-auto pt-4 flex items-center gap-1.5 text-[12px] font-medium text-gray-400">
                                        <Calendar size={12} /> {rel.date}
                                    </div>
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
      </div>

      {article && (
        <SocialShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          content={{
            kind: 'article',
            id: article.id,
            title: article.title,
            subtitle: (article as any).category,
            summary: (article as any).excerpt || (article as any).summary,
            image: article.image,
            tags: [(article as any).category].filter(Boolean) as string[],
          }}
        />
      )}
    </div>
  );
};

export default ArticleDetails;