import React from 'react';
import { Home, ShieldCheck, Mail, Building, Globe, MapPin } from 'lucide-react';
import { PageBreadcrumb } from './ui/PageBreadcrumb';

const Legal: React.FC<any> = ({ onGoHome }) => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16">
      <div className="relative w-full h-[35vh] md:h-[30vh] lg:h-[45vh] flex flex-col md:items-center md:justify-center px-6 font-sans overflow-hidden bg-primary-50">
        <div className="absolute inset-0 overflow-hidden z-0">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://www.moto-scoot.tn/hero-assets/-hero-background.webp')" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-primary-700 to-primary-600 opacity-95 mix-blend-multiply" />
        </div>
        <div className="relative z-10 flex flex-col justify-center items-center w-full max-w-7xl mx-auto h-full pt-20">
          <div className="text-center px-4 md:mt-32">
            <h1 className="text-3xl md:text-6xl font-extrabold text-white mb-4 drop-shadow-sm tracking-tight leading-tight animate-fade-in-up">Mentions Légales</h1>
            <p className="text-white/90 text-lg md:text-xl font-medium max-w-2xl mx-auto animate-fade-in-up opacity-90">Transparence et conformité.</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32 py-12 md:py-16">
        <header className="flex items-center justify-between mb-8 md:mb-12">
           <PageBreadcrumb
             parents={[
               { label: 'Accueil', href: '/', onClick: onGoHome },
             ]}
             current={'Mentions légales'}
           />
        </header>

        <article className="prose prose-slate max-w-4xl bg-card p-8 md:p-12 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-12">
            <section className="space-y-4">
                <div className="flex items-center gap-3 text-primary-600 mb-2"><Building size={24} /><h2 className="text-2xl font-black m-0">Éditeur</h2></div>
                <p className="text-gray-600">Magma Studio S.U.A.R.L, 3 Rue Mami, La Marsa. MF: 1234567/A.</p>
            </section>
            <section className="space-y-4">
                <div className="flex items-center gap-3 text-primary-600 mb-2"><Globe size={24} /><h2 className="text-2xl font-black m-0">Hébergement</h2></div>
                <p className="text-gray-600">OVH Cloud, Roubaix, France.</p>
            </section>
            <section className="space-y-4">
                <div className="flex items-center gap-3 text-primary-600 mb-2"><ShieldCheck size={24} /><h2 className="text-2xl font-black m-0">Propriété</h2></div>
                <p className="text-gray-600 leading-relaxed">
                  MotoScoot est une marque déposée auprès de l'INORPI. L'utilisation du site moto-scoot.tn ou moto-scoot.tn ainsi que de la marque MotoScoot sont la propriété exclusive de <a href="https://magma-studio.tn" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline font-bold">Magma Studio</a>.
                </p>
            </section>
            <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-xs text-gray-400 font-black">Octobre 2025</p>
                <button onClick={onGoHome} className="px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold flex items-center gap-2"><Home size={18} /> Retour</button>
            </div>
        </article>
      </div>
    </div>
  );
};

export default Legal;