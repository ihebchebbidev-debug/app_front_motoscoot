import React from 'react';
import { Facebook, Instagram, Linkedin, MapPin, Mail, Phone, Twitter, Youtube, Music2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { siteSettingsApi, SOCIAL_NETWORKS } from '../services/siteSettingsApi';

const SOCIAL_ICONS = { facebook: Facebook, instagram: Instagram, tiktok: Music2, youtube: Youtube, linkedin: Linkedin, x: Twitter } as const;

/** Footer social links managed from the backoffice; unset networks are hidden. */
function useSocialItems() {
  const { data } = useQuery({
    queryKey: ['site-settings', 'social-links'],
    queryFn: ({ signal }) => siteSettingsApi.getSocialLinks(signal),
    staleTime: 1000 * 60 * 10,
  });
  return SOCIAL_NETWORKS
    .filter(({ key }) => typeof data?.[key] === 'string' && data[key])
    .map(({ key, label }) => ({ key, label, href: data![key] as string, Icon: SOCIAL_ICONS[key] }));
}
import { SectionLabel } from './ui/Typography';
import Newsletter from './Newsletter';

interface FooterProps {
  onNavigate?: (view: string) => void;
}

const FooterHeading = ({ children }: React.PropsWithChildren<{}>) => (
  <h3 className="font-black text-lg mb-6 text-white tracking-tight uppercase">{children}</h3>
);

const FooterLink = ({ onClick, children, isPrimary = false, icon, className }: React.PropsWithChildren<{ onClick?: () => void, isPrimary?: boolean, icon?: React.ReactNode, className?: string }>) => (
  <li className={className}>
    <button 
      onClick={onClick} 
      className={`transition-colors flex items-center gap-2 focus:outline-none hover:underline text-left ${isPrimary ? 'text-primary-600 font-black' : 'text-gray-400 hover:text-white font-medium'}`}
    >
      {!isPrimary && !icon && <span className="w-1 h-1 rounded-full bg-gray-600"></span>}
      {icon}
      {children}
    </button>
  </li>
);

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const socialItems = useSocialItems();
  const LOGO_WHITE = "https://www.moto-scoot.tn/site-logo/logo-white.svg";

  return (
    <footer className="bg-neutral-950 text-white pt-20 pb-10 border-t border-neutral-900" role="contentinfo">
      <div className="max-w-[1440px] mx-auto px-6 md:px-16 lg:px-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand Column */}
          <div className="space-y-8">
            <button 
              className="flex flex-col items-start gap-4 cursor-pointer group focus:outline-none text-left" 
              onClick={() => onNavigate?.('home')}
              aria-label="Retour à l'accueil"
            >
               <img 
                 src={LOGO_WHITE} 
                 alt="moto-scoot.tn" width={373} height={48} 
                 className="h-6 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
               />
               <SectionLabel className="text-primary-600">La référence moto</SectionLabel>
            </button>
            <p className="text-gray-500 text-sm leading-relaxed font-medium max-w-xs">
              La référence en Tunisie pour l'achat et la vente de motos d'occasion et neuves. Trouvez votre liberté sur deux roues.
            </p>
            <div className="flex gap-4">
              {socialItems.map(({ key, label, href, Icon }) => (
                <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center text-gray-500 hover:bg-primary-600 hover:text-white transition-all duration-300 border border-neutral-800" aria-label={label}>
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <FooterHeading>Navigation</FooterHeading>
            <ul className="space-y-4 text-sm">
              <FooterLink onClick={() => onNavigate?.('home')}>Accueil</FooterLink>
              <FooterLink onClick={() => onNavigate?.('search')}>Annonces</FooterLink>
              <FooterLink onClick={() => onNavigate?.('news')}>Actualités</FooterLink>
              <FooterLink onClick={() => onNavigate?.('contact')}>Contact</FooterLink>
            </ul>
          </div>

          {/* Legal / Info */}
          <div>
            <FooterHeading>Informations</FooterHeading>
            <ul className="space-y-4 text-sm">
              <FooterLink onClick={() => onNavigate?.('about')}>À propos de nous</FooterLink>
              <FooterLink onClick={() => onNavigate?.('terms')}>Conditions Générales</FooterLink>
              <FooterLink onClick={() => onNavigate?.('legal')}>Confidentialité</FooterLink>
              <FooterLink onClick={() => onNavigate?.('cookies')}>Cookies</FooterLink>
              <FooterLink onClick={() => onNavigate?.('faq')}>FAQ</FooterLink>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <FooterHeading>Contact</FooterHeading>
            <ul className="space-y-6 text-sm">
              <li className="flex items-start gap-4 group">
                <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                  <MapPin size={18} aria-hidden="true" />
                </div>
                <span className="leading-relaxed text-gray-400 font-medium pt-1">3, Rue Mami - 2070<br />La Marsa, Tunisie</span>
              </li>
              <li className="flex items-center gap-4 group">
                <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                  <Phone size={18} aria-hidden="true" />
                </div>
                <a href="tel:+21629249512" className="font-bold text-gray-400 hover:text-white transition-colors">29 249 512</a>
              </li>
              <li className="flex items-center gap-4 group">
                <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                  <Mail size={18} aria-hidden="true" />
                </div>
                <a href="mailto:contact@moto-scoot.tn" className="font-bold text-gray-400 hover:text-white transition-colors">contact@moto-scoot.tn</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter signup */}
        <div className="mb-12 p-8 bg-neutral-900 rounded-2xl border border-neutral-800 flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
          <div className="max-w-md">
            <h3 className="font-black text-xl text-white mb-2">Restez informé</h3>
            <p className="text-sm text-gray-400">Nouvelles annonces, conseils et bons plans, directement dans votre boîte mail.</p>
          </div>
          <Newsletter className="w-full md:w-auto md:min-w-[400px]" />
        </div>

        {/* Bottom Bar */}
        <div className="pt-10 border-t border-neutral-900 flex flex-col md:flex-row justify-between items-center gap-8 text-[12px] font-black uppercase tracking-widest text-gray-500">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-center md:text-left">
            <p>© {new Date().getFullYear()} MotoScoot. Tous droits réservés.</p>
            <p className="md:border-l md:border-neutral-900 md:pl-8">
              Réalisé par <a href="https://magma-studio.tn" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">magma-studio.tn</a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;