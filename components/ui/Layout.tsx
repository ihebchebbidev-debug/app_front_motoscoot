import React, { useEffect } from 'react';
import Header from '../layout/Header';
import Footer from '../Footer';
import { throttle } from '../../utils/perfUtils';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

interface PageLayoutProps {
  children: React.ReactNode;
  variant?: 'white' | 'transparent';
  onNavigate?: (view: any, params?: any) => void;
  onGoHome?: () => void;
  isLoggedIn?: boolean;
  onTriggerLogin?: () => void;
  onLogout?: () => void;
  hideFooter?: boolean;
  /** Hide the public site Header (used by full-screen admin chrome). */
  hideHeader?: boolean;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  variant = 'white',
  onNavigate,
  onGoHome,
  isLoggedIn,
  onTriggerLogin,
  onLogout,
  hideFooter = false,
  hideHeader = false,
}) => {
  const isOnline = useOnlineStatus();
  
  useEffect(() => {
    let lastWidth = window.innerWidth;
    
    const handleResize = throttle(() => {
      // Sur mobile, le scroll masque la barre d'adresse et déclenche un 'resize' (changement de hauteur).
      // Pour éviter les sauts de layout et la "résistance" au scroll, on ne recalcule --vh que si la LARGEUR change (ex: rotation de l'écran).
      if (window.innerWidth !== lastWidth) {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        lastWidth = window.innerWidth;
      }
    }, 250);

    // Initial calculation
    const initialVh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${initialVh}px`);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-primary-100 selection:text-primary-900">
      {!isOnline && (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white py-2 px-4 z-[110] flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest animate-fade-in">
          <WifiOff size={14} /> Mode hors-ligne - Vérifiez votre connexion
        </div>
      )}
      
      {/* 
          Fix: Header uses useAppNavigation internally, so passing navigation props here 
          is redundant and causes TypeScript errors based on Header's defined props.
          When `hideHeader` is true (admin console), we skip the public navbar AND
          its compensating top padding so the admin shell can use the full viewport.
      */}
      {!hideHeader && <Header variant={variant} />}
      
      <main
        className={`flex-grow outline-none pb-0 ${
          !hideHeader && variant === 'white' ? 'pt-24 md:pt-[4.75rem]' : ''
        }`}
      >
        {children}
      </main>

      {!hideFooter && !hideHeader && (
        <Footer 
          onNavigate={(view) => onNavigate?.(view)} 
        />
      )}
    </div>
  );
};
