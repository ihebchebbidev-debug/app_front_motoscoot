import React from 'react';
import { Home, Scale, AlertCircle, ShieldCheck } from 'lucide-react';
import { PageBreadcrumb } from './ui/PageBreadcrumb';

const Terms: React.FC<any> = ({ onGoHome }) => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16">
      <div className="relative w-full h-[35vh] md:h-[30vh] lg:h-[45vh] flex flex-col md:items-center md:justify-center px-6 font-sans overflow-hidden bg-primary-50">
        <div className="absolute inset-0 overflow-hidden z-0">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://www.moto-scoot.tn/hero-assets/-hero-background.webp')" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-primary-700 to-primary-600 opacity-95 mix-blend-multiply" />
        </div>
        <div className="relative z-10 flex flex-col justify-center items-center w-full max-w-[1280px] mx-auto h-full pt-20">
          <div className="text-center px-4 md:mt-32">
            <h1 className="text-3xl md:text-6xl font-extrabold text-white mb-4 drop-shadow-sm tracking-tight leading-tight animate-fade-in-up">CGU</h1>
            <p className="text-white/90 text-lg md:text-xl font-medium max-w-2xl mx-auto animate-fade-in-up">Règles d'utilisation.</p>
          </div>
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto px-6 py-12 md:py-16">
        <header className="flex items-center justify-between mb-8 md:mb-12">
           <PageBreadcrumb
             parents={[
               { label: 'Accueil', href: '/', onClick: onGoHome },
             ]}
             current={'CGU'}
           />
        </header>
        <article className="bg-card p-8 md:p-12 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-12 max-w-4xl">
            <section className="space-y-4"><div className="flex items-center gap-3 text-primary-600 mb-2"><Scale size={24} /><h2 className="text-2xl font-black m-0 text-gray-900">1. Objet</h2></div><p className="text-gray-600">moto-scoot.tn est une plateforme de mise en relation entre acheteurs et vendeurs.</p></section>
            <section className="space-y-4"><div className="flex items-center gap-3 text-primary-600 mb-2"><AlertCircle size={24} /><h2 className="text-2xl font-black m-0 text-gray-900">2. Responsabilité</h2></div><p className="text-gray-600">L'annonceur est seul responsable du contenu de sa publication.</p></section>
            <div className="pt-8 border-t border-gray-100 flex justify-between items-center"><div className="flex items-center gap-2 text-gray-400"><ShieldCheck size={18} /><span>Octobre 2025</span></div><button onClick={onGoHome} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold flex items-center gap-2"><Home size={18} /> Accueil</button></div>
        </article>
      </div>
    </div>
  );
};

export default Terms;