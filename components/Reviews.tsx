import React, { useMemo } from 'react';
import { Star, MessageSquareQuote } from 'lucide-react';
import { useSiteReviews } from '../hooks/useSiteReviews';
import { ReviewCard } from './home/ReviewCard';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import type { Review } from '../types';
import { publishedReviewAverage } from '../utils/reviewUtils';

const Reviews: React.FC = () => {
  const { data: siteReviews = [], isLoading } = useSiteReviews();

  const reviews = useMemo<Review[]>(
    () =>
      siteReviews.map((r) => ({
        id: r.id,
        name: r.name,
        role: r.role || 'Membre',
        // Always use the branded MotoScoot helmet placeholder for visual
        // consistency across the "Ce qu'ils disent de nous" section.
        image: '',
        content: r.content,
        rating: r.rating,
        isAdminEntry: r.is_admin_entry === true,
        date: r.date || (r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : ''),
      })),
    [siteReviews],
  );
  const average = publishedReviewAverage(reviews);

  return (
    <section className="py-20 md:py-32 bg-card relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8 text-left">
          <div className="max-w-2xl">
            <h2 className="text-primary-600 text-[36px] font-extrabold tracking-normal mb-6 leading-tight animate-fade-in-up">
              Avis de la communauté
            </h2>
            <p className="text-gray-500 text-[17px] font-normal tracking-normal leading-relaxed animate-fade-in-up">
              Les avis des motards qui utilisent MotoScoot pour acheter, vendre et comparer des motos et scooters en Tunisie.
            </p>
          </div>

          {average !== null && <div className="hidden md:flex flex-col items-end animate-fade-in-up">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-3xl font-black text-gray-900">{average.toLocaleString('fr-FR')}</span>
              <span className="text-gray-400 text-lg font-bold">/5</span>
            </div>
            <div className="flex gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={20} className={i < Math.round(average) ? "text-warning-400 fill-warning-400" : "text-gray-300"} />
              ))}
            </div>
            <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">
              {reviews.length} avis publiés
            </span>
          </div>}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={MessageSquareQuote}
            title="Soyez le premier à témoigner"
            description="Aucun avis n'a encore été publié. Partagez votre expérience pour aider la communauté MotoScoot."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {reviews.map((review, index) => (
              <ReviewCard key={review.id} review={review} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Reviews;
