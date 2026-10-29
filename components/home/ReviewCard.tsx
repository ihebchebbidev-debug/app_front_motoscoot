import React, { useState } from 'react';
import { Star, Quote, CheckCircle2 } from 'lucide-react';
import { Review } from '../../types';
import { PLACEHOLDER_AVATAR } from '../../utils/urlUtils';

interface ReviewCardProps {
  review: Review;
  index: number;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ review, index }) => {
  const [imgError, setImgError] = useState(false);
  const avatarSrc = imgError || !review.image ? PLACEHOLDER_AVATAR : review.image;

  return (
    <div 
      className="group flex flex-col h-full bg-card rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-300 relative opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${400 + (index * 150)}ms`, animationFillMode: 'forwards' }}
    >
      {/* Decorative Quote Icon */}
      <div className="absolute top-8 right-8 text-gray-100 group-hover:text-gray-200 transition-colors duration-300">
        <Quote size={48} className="fill-current transform rotate-12" />
      </div>

      {/* User Profile */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <img
            src={avatarSrc}
            alt={review.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md bg-orange-50"
          />
        </div>
        <div>
          <h4 className="font-black text-gray-900 text-lg tracking-tight">{review.name}</h4>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{review.role}</span>
        </div>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={16}
            className={`${i < review.rating ? 'text-warning-400 fill-warning-400' : 'text-gray-200 fill-gray-200'}`}
          />
        ))}
        <span className="text-[12px] text-gray-400 ml-2 font-black uppercase tracking-widest">{review.date}</span>
      </div>

      {/* Content */}
      <p className="text-gray-600 leading-relaxed font-medium relative z-10 flex-grow italic">
        "{review.content}"
      </p>

      {/* Verified Badge */}
      <div className="mt-6 pt-4 border-t border-gray-50 flex items-center gap-2">
        <Quote className="w-4 h-4 text-primary-600" />
        <span className="text-[12px] font-black text-gray-400 uppercase tracking-[0.2em]">{review.isAdminEntry ? 'Témoignage ajouté par l’équipe' : 'Avis de la communauté'}</span>
      </div>
    </div>
  );
};