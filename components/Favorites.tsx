
import React from 'react';
import { Heart, MapPin, ShieldCheck, User, ArrowRight, Home, ChevronRight, ArrowLeft, HeartOff } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import { BasePageProps } from '../types';
import { EmptyState } from './ui/EmptyState';
import SEO from './common/SEO';

const Favorites: React.FC<BasePageProps> = ({ onGoHome, onNavigate }) => {
  const { favorites, toggleFavorite, favoriteListings } = useFavorites();
  // Server-hydrated favorite listings only — empty state if none.
  const savedListings = favoriteListings || [];

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      <SEO title="Mes Favoris" description="Vos annonces moto et scooter sauvegardées sur MotoScoot.tn." noIndex url="/mes-favoris" />
      <main className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32 pt-28 pb-8">
        <header className="flex items-center justify-between mb-4 md:mb-6">
           <div className="flex items-center gap-3 md:gap-4">
              <button onClick={onGoHome} className="p-1.5 md:p-2 bg-card border border-gray-100 rounded-lg md:rounded-xl text-gray-700 hover:text-primary-600 shadow-sm transition-all active:scale-95" aria-label="Retour"><ArrowLeft size={16} className="md:w-5 md:h-5"/></button>
              <nav className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-[13px] font-medium text-gray-400">
                 <span className="flex items-center gap-1 hover:text-primary-600 cursor-pointer" onClick={onGoHome}>
                   <Home size={12} className="md:w-3.5 md:h-3.5" /> Accueil
                 </span>
                 <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                 <span className="text-gray-900 font-extrabold truncate max-w-[100px] md:max-w-none">Mes Favoris</span>
              </nav>
           </div>
        </header>

        <div className="flex items-end justify-between mb-8">
           <div><h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">Ma sélection</h1><p className="text-gray-500 font-medium">Toutes vos annonces sauvegardées.</p></div>
           <div className="hidden md:block"><span className="bg-primary-50 text-primary-700 px-4 py-2 rounded-xl font-bold border border-primary-100">{savedListings.length} annonces</span></div>
        </div>

        {savedListings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {savedListings.map((listing, index) => (
                <article key={listing.id} onClick={() => onNavigate?.('listing-details', { id: listing.id, title: listing.title })} className="group bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md border border-gray-100 cursor-pointer flex flex-col animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <div className="relative aspect-[3/2] bg-card overflow-hidden">
                      <img src={listing.image} alt={listing.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" />
                      <button onClick={(e) => { e.stopPropagation(); toggleFavorite('listing', listing.id as any); }} className="absolute top-3 right-3 p-2 bg-card/90 rounded-full text-red-500 shadow-sm z-10 animate-heartbeat"><Heart size={18} fill="currentColor" /></button>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                      <div className="flex flex-col mb-2"><h3 className="text-xl font-black text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-1 leading-tight">{listing.title}</h3><span className="text-lg font-black text-primary-600 uppercase tracking-tighter mt-1">{listing.price}</span></div>
                      <div className="flex items-center text-xs text-gray-500 font-medium mb-4"><MapPin size={12} className="mr-1 text-primary-500" />{listing.location}</div>
                      <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              {listing.sellerType === 'Pro' ? <ShieldCheck size={14} className="text-primary-600" /> : <User size={14} className="text-gray-400" />}
                              <span className="text-xs font-bold text-gray-700 truncate max-w-[120px]">{listing.seller}</span>
                          </div>
                          <span className="text-primary-600 text-xs font-bold flex items-center gap-1 uppercase tracking-widest">Voir <ArrowRight size={12} /></span>
                      </div>
                  </div>
                </article>
            ))}
          </div>
        ) : (
          <EmptyState
            variant="card"
            icon={HeartOff}
            title="Votre sélection est vide"
            description="Cliquez sur le cœur d'une annonce pour la retrouver ici à tout moment."
            action={{ label: 'Explorer les annonces', onClick: () => onNavigate?.('search') }}
            secondaryAction={{ label: 'Voir les garages', onClick: () => onNavigate?.('garages') }}
          />
        )}
      </main>
    </div>
  );
};

export default Favorites;
