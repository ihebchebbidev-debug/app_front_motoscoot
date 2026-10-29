import React from 'react';
import { Home, ChevronRight, Cookie, ShieldCheck, ArrowLeft } from 'lucide-react';

const Cookies: React.FC<any> = ({ onGoHome }) => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16">
      <div className="relative w-full h-[35vh] md:h-[30vh] lg:h-[45vh] flex flex-col md:items-center md:justify-center px-6 font-sans overflow-hidden bg-primary-50">
        <div className="absolute inset-0 overflow-hidden z-0">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://www.moto-scoot.tn/hero-assets/-hero-background.webp')" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-primary-700 to-primary-600 opacity-95 mix-blend-multiply" />
        </div>
        <div className="relative z-10 flex flex-col justify-center items-center w-full max-w-[1280px] mx-auto h-full pt-20">
          <div className="text-center px-4 md:mt-32"><h1 className="text-3xl md:text-6xl font-extrabold text-white mb-4 animate-fade-in-up">Cookies</h1></div>
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto px-6 py-12 md:py-16">
        <header className="flex items-center justify-between mb-8 md:mb-12">
           <div className="flex items-center gap-3 md:gap-4">
              <button onClick={onGoHome} className="p-1.5 md:p-2 bg-card border border-gray-100 rounded-lg md:rounded-xl text-gray-700 hover:text-primary-600 shadow-sm transition-all active:scale-95" aria-label="Retour"><ArrowLeft size={16} className="md:w-5 md:h-5"/></button>
              <nav className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-[13px] font-medium text-gray-400">
                 <span className="flex items-center gap-1 hover:text-primary-600 cursor-pointer" onClick={onGoHome}>
                   <Home size={12} className="md:w-3.5 md:h-3.5" /> Accueil
                 </span>
                 <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                 <span className="text-gray-900 font-extrabold truncate max-w-[100px] md:max-w-none">Cookies</span>
              </nav>
           </div>
        </header>
        <article className="bg-card p-8 md:p-12 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-12 max-w-4xl">
            <section className="space-y-4"><div className="flex items-center gap-3 text-primary-600 mb-2"><Cookie size={24} /><h2 className="text-2xl font-black m-0 text-gray-900">Utilisation</h2></div><p className="text-gray-600">Nous utilisons des cookies essentiels au fonctionnement du site et de vos favoris.</p></section>
            <div className="pt-8 border-t border-gray-100 flex justify-between items-center"><div className="flex items-center gap-2 text-gray-400"><ShieldCheck size={18} /><span>Octobre 2025</span></div><button onClick={onGoHome} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold flex items-center gap-2"><Home size={18} /> Accueil</button></div>
        </article>
      </div>
    </div>
  );
};

export default Cookies;