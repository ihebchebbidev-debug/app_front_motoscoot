import React from 'react';
import { ShieldCheck, Zap, Heart, Users, Globe, ChevronRight } from 'lucide-react';
import SEO from './common/SEO';

interface AboutProps {
  onGoHome?: () => void;
  onNavigate?: (view: any, params?: any) => void;
}

const About: React.FC<AboutProps> = ({ onGoHome, onNavigate }) => {
  return (
    <div className="min-h-screen bg-card font-sans overflow-x-hidden">
      <SEO
        title="À propos de moto-scoot.tn — La 1ʳᵉ Marketplace Moto en Tunisie"
        description="Découvrez moto-scoot.tn : la plateforme tunisienne pensée par des motards pour l'achat et la vente sécurisés de motos et scooters d'occasion."
        url="/a-propos"
        keywords={['à propos MotoScoot', 'marketplace moto Tunisie', 'plateforme motards']}
        breadcrumbs={[
          { name: 'Accueil', url: '/' },
          { name: 'À propos', url: '/a-propos' },
        ]}
      />
      <div className="relative w-full h-[40vh] md:h-[60vh] flex flex-col items-center justify-center font-sans overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://www.moto-scoot.tn/hero-assets/-hero-background.webp')" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-primary-700 to-primary-600 opacity-95 mix-blend-multiply" />
        </div>
        <div className="relative z-10 text-center px-6">
          <h1 className="text-4xl md:text-7xl font-black text-white mb-6 animate-fade-in-up">MotoScoot</h1>
          <p className="text-white text-lg md:text-2xl font-medium max-w-3xl mx-auto animate-fade-in-up opacity-90">La première plateforme tunisienne pensée par des motards, pour des motards.</p>
        </div>
      </div>

      <section className="py-24 bg-card">
        <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32 text-center">
            <h2 className="text-xs font-black text-primary-600 uppercase tracking-[0.3em] mb-12">Notre Manifeste</h2>
            <p className="text-2xl md:text-4xl font-bold text-gray-900 leading-tight tracking-tight">Nous croyons que chaque trajet est une aventure. Nous rendons l'achat et la vente de motos fluides, sûrs et passionnants.</p>
            <div className="mt-16 w-12 h-1 bg-primary-600 mx-auto rounded-full"></div>
        </div>
      </section>

      <section className="py-12 md:py-24 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-card rounded-[2.5rem] p-10 border border-gray-100 shadow-sm">
                <ShieldCheck className="text-primary-600 mb-8" size={32} />
                <h3 className="text-2xl font-black text-gray-900 mb-4">Confiance.</h3>
                <p className="text-gray-500 font-medium">Chaque annonce est vérifiée manuellement par nos modérateurs.</p>
            </div>
            <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white shadow-xl">
                <Zap className="text-primary-500 mb-8" size={32} />
                <h3 className="text-2xl font-bold mb-4">Innovation.</h3>
                <p className="text-gray-400 font-medium">Recherche intelligente et fiches techniques exhaustives.</p>
            </div>
            <div className="bg-card rounded-[2.5rem] p-10 border border-gray-100 shadow-sm">
                <Heart className="text-primary-600 mb-8" size={32} />
                <h3 className="text-2xl font-black text-gray-900 mb-4">Passion.</h3>
                <p className="text-gray-500 font-medium">Une équipe de motards qui comprend vos besoins.</p>
            </div>
            <div className="bg-primary-600 rounded-[2.5rem] p-10 text-white shadow-xl">
                <Globe className="text-white mb-8" size={32} />
                <h3 className="text-2xl font-black mb-4">National.</h3>
                <p className="text-white/80 font-medium">De Tunis à Tataouine, trouvez tout ce qu'il vous faut.</p>
            </div>
        </div>
      </section>
    </div>
  );
};

export default About;