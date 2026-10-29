import React, { useState } from 'react';
import { ArrowRight, MapPin, Star, Clock, ShieldCheck, Navigation } from 'lucide-react';
import { Garage } from '../../types';
import { getOptimizedImageUrl, PLACEHOLDER_GARAGE } from '../../utils/urlUtils';

interface GarageCardProps {
  garage: Garage & { distance?: number | null };
  onClick: () => void;
}

/**
 * GarageCard - Version résiliente et homogène.
 * Ratio d'image fixé à 4:3 pour un équilibre visuel optimal dans les listes.
 */
export const GarageCard: React.FC<GarageCardProps> = ({ garage, onClick }) => {
  const [imgError, setImgError] = useState(false);
  
  // Optimisation de l'image au ratio 4:3 (ex: 600x450)
  const optimizedSrc = imgError 
    ? PLACEHOLDER_GARAGE
    : getOptimizedImageUrl(garage.image, 600, 450, 75, PLACEHOLDER_GARAGE, garage.name);
  
  const isNear = garage.distance !== undefined && garage.distance !== null && garage.distance < 20;

  return (
    <div 
      className="group relative bg-card rounded-[14px] overflow-hidden shadow-sm hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] transition-all duration-300 border border-gray-100 cursor-pointer h-full flex flex-col active:scale-[0.98] [contain:content]"
      onClick={onClick}
    >
      {/* Container Image avec ratio 4:3 strict */}
      <div className="aspect-[4/3] overflow-hidden relative bg-card shrink-0">
        <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors z-10" />
        <img 
          src={optimizedSrc} 
          alt={garage.name} 
          loading="lazy"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
        />
        
        {/* Badge Proximité */}
        {garage.distance !== undefined && garage.distance !== null && (
          <div className={`absolute left-0 top-0 z-20 px-3 py-1.5 rounded-br-xl border-b border-r flex items-center gap-1.5 text-[12px] font-black uppercase tracking-tight shadow-sm ${
            isNear ? 'bg-primary-600 text-white border-primary-600' : 'bg-card/95 backdrop-blur-md text-gray-700 border-gray-100'
          }`}>
              <Navigation size={10} className={isNear ? 'text-white' : 'text-primary-500'} fill={isNear ? 'currentColor' : 'none'} />
              <span>{garage.distance} km</span>
          </div>
        )}

        {/* Note du garage */}
        <div className="absolute top-3 right-3 z-20">
          <div className="bg-card/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[12px] font-black text-gray-900 shadow-sm flex items-center gap-1 border border-white/50">
            <Star className="w-3 h-3 text-warning-400 fill-warning-400" />
            {garage.rating}
          </div>
        </div>
      </div>

      {/* Section Contenu avec hauteur flexible pour équilibrer la carte */}
      <div className="p-5 flex-1 flex flex-col">
        
        {/* Titre et Vérification */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-[17px] font-[900] text-foreground line-clamp-1 leading-tight tracking-tight">
            {garage.name}
          </h3>
          {garage.isVerified && (
            <ShieldCheck 
              size={16} 
              className="text-success-600 shrink-0 mt-0.5" 
              strokeWidth={3}
            />
          )}
        </div>

        {/* Expertise */}
        <p className="text-[12px] font-[500] text-gray-500 line-clamp-2 leading-relaxed mb-4">
          {garage.description || "Expert moto et scooter à votre service pour tout entretien et réparation mécanique."}
        </p>

        {/* Informations de bas de carte */}
        <div className="mt-auto space-y-2">
          <div className="flex items-center gap-2 text-[12px] font-[800] text-gray-700 uppercase tracking-tight">
            <MapPin size={12} className="text-primary-600 shrink-0" strokeWidth={3} />
            <span className="truncate">{garage.location}</span>
          </div>

          <div className="flex items-center gap-2 text-[12px] font-[700] text-gray-400 tracking-tight">
            <Clock size={12} className="shrink-0" strokeWidth={2.5} />
            <span className="truncate">{garage.hours || "Mardi au Dimanche : 09:00 – 19:00"}</span>
          </div>

          <div className="pt-3 mt-3 border-t border-gray-50 flex justify-between items-center group/btn">
            <span className="text-[12px] font-black text-primary-600 uppercase tracking-[0.15em]">
              Voir détails
            </span>
            <div className="p-1.5 bg-primary-50 rounded-full text-primary-600 group-hover/btn:bg-primary-600 group-hover/btn:text-white transition-all">
              <ArrowRight size={14} strokeWidth={3} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};