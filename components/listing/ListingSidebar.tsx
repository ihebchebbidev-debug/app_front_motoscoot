import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ListingSellerCard } from './ListingSellerCard';
import AdBanner from '../common/AdBanner';
import { Listing } from '../../types';

interface ListingSidebarProps {
  listing: Listing;
  onShare?: () => void;
  onReport?: () => void;
}

const S = {
  SidebarCol: "lg:col-span-5 xl:col-span-4",
  StickyWrapper: "md:sticky md:top-28 flex flex-col gap-4",
  TrustBox: "bg-card rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4",
  TrustTitle: "text-[12px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 md:font-sans md:font-[800] md:text-[14px] md:text-foreground md:leading-[16px] md:tracking-[0px] md:uppercase",
  TrustItem: "flex items-start gap-3",
  TrustText: "text-[12px] font-medium text-gray-500 leading-relaxed",
  Disclaimer: "text-[12px] font-bold text-gray-400 leading-relaxed pt-3 border-t border-gray-50 italic"
};

export const ListingSidebar: React.FC<ListingSidebarProps> = ({ 
  listing, 
  onShare,
  onReport
}) => {
  const securityTips = [
    "Méfiez-vous des offres trop belles pour être vraies.",
    "Ne payez jamais sans avoir vu et testé le véhicule.",
    "Rencontrez le vendeur dans un endroit sûr et fréquenté.",
    "Contrôlez la carte grise et le numéro de série.",
    "Évitez les transferts d'argent à distance."
  ];

  return (
    <aside className={S.SidebarCol}>
      <div className={S.StickyWrapper}>
        
        {/* Publicité Mobile Uniquement (Avant Seller Card) */}
        <div className="md:hidden">
          <AdBanner 
            zone="listing_sidebar" 
            variant="banner" 
            className="aspect-square w-full rounded-[24px] border border-gray-100 shadow-sm overflow-hidden" 
          />
        </div>

        {/* Carte Vendeur & Prix (Desktop & Mobile) */}
        <ListingSellerCard 
          listing={listing}
          onShare={onShare}
        />

        {/* Publicité (Desktop/Tablette) - Format Carré - Placé APRÈS la carte vendeur */}
        <div className="hidden md:block">
          <AdBanner 
            zone="listing_sidebar" 
            variant="banner" 
            className="aspect-square w-full rounded-[24px] border border-gray-100 shadow-sm overflow-hidden" 
          />
        </div>

        {/* Bloc de réassurance */}
        <div className={S.TrustBox}>
          <h3 className={S.TrustTitle}>
            <ShieldCheck size={16} className="text-primary-600" />
            Conseils de sécurité :
          </h3>
          <div className="space-y-1.5">
            {securityTips.map((tip, idx) => (
              <div key={idx} className={S.TrustItem}>
                <div className="w-1.5 h-1.5 rounded-full bg-primary-600 mt-1.5 shrink-0" />
                <p className={S.TrustText}>{tip}</p>
              </div>
            ))}
          </div>

          <p className={S.Disclaimer}>
            moto-scoot.tn est une plateforme de mise en relation. Nous déclinons toute responsabilité quant aux véhicules annoncés et aux transactions entre utilisateurs.
          </p>

          <div className="pt-2">
            <button 
              onClick={onReport}
              className="w-full flex items-center justify-center gap-2 p-3 bg-orange-50/50 rounded-xl border border-orange-100/50 hover:bg-orange-100 transition-colors group"
            >
              <AlertTriangle size={14} className="text-orange-600 group-hover:scale-110 transition-transform" />
              <span className="text-[12px] font-black text-orange-800 uppercase tracking-tight">Signaler un abus</span>
            </button>
          </div>
        </div>

      </div>
    </aside>
  );
};