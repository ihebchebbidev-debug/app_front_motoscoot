import React from 'react';
import { Home, ChevronRight, AlertTriangle, UserCheck, Smartphone, Mail, ShieldCheck, ArrowLeft } from 'lucide-react';

const Security: React.FC<any> = ({ onGoHome, onNavigate }) => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16">
      <div className="relative w-full h-[35vh] md:h-[30vh] lg:h-[45vh] flex flex-col md:items-center md:justify-center px-6 font-sans overflow-hidden bg-primary-50">
        <div className="absolute inset-0 overflow-hidden z-0">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://www.moto-scoot.tn/hero-assets/-hero-background.webp')" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-primary-700 to-primary-600 opacity-95 mix-blend-multiply" />
        </div>
        <div className="relative z-10 flex flex-col justify-center items-center w-full max-w-[1280px] mx-auto h-full pt-20">
          <div className="text-center px-4 md:mt-32">
            <h1 className="text-3xl md:text-6xl font-extrabold text-white mb-4 drop-shadow-sm tracking-tight leading-tight animate-fade-in-up">Sécurité</h1>
            <p className="text-white/90 text-lg md:text-xl font-medium max-w-2xl mx-auto animate-fade-in-up opacity-90">Conseils pour acheter et vendre sereinement.</p>
          </div>
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
                 <span className="text-gray-900 font-extrabold truncate max-w-[100px] md:max-w-none">Sécurité</span>
              </nav>
           </div>
        </header>
        <div className="space-y-8 max-w-4xl">
            <div className="bg-card p-8 md:p-10 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 text-primary-600 mb-6"><UserCheck size={28} /><h2 className="text-2xl font-black m-0">Acheteurs</h2></div>
                <ul className="space-y-6 text-gray-600 list-none p-0">
                    <li className="flex gap-4"><div className="w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 font-bold text-xs">1</div><p><strong>Pas d'acompte :</strong> Ne payez rien sans voir la moto.</p></li>
                    <li className="flex gap-4"><div className="w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 font-bold text-xs">2</div><p><strong>Lieux publics :</strong> Inspectez le véhicule de jour en public.</p></li>
                </ul>
            </div>
            <div className="bg-neutral-900 p-8 md:p-12 rounded-[2.5rem] text-white relative overflow-hidden shadow-xl">
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-6"><AlertTriangle className="text-primary-500" size={32} /><h2 className="text-2xl md:text-3xl font-black m-0">Signaler</h2></div>
                    <p className="text-gray-400 text-lg mb-8 leading-relaxed">Une annonce louche ? Aidez la communauté.</p>
                    <button onClick={() => onNavigate?.('contact')} className="px-8 py-4 bg-primary-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2"><Mail size={20} /> Modération</button>
                </div>
            </div>
            <div className="pt-12 flex justify-between items-center"><div className="flex items-center gap-2 text-gray-400"><ShieldCheck size={18} /><span className="text-sm">Sécurité MotoScoot</span></div><button onClick={onGoHome} className="px-6 py-3 bg-gray-100 text-gray-900 rounded-xl font-bold flex items-center gap-2"><Home size={18} /> Accueil</button></div>
        </div>
      </div>
    </div>
  );
};

export default Security;