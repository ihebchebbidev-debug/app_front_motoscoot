import type React from 'react';
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { siteSettingsApi, SOCIAL_NETWORKS, type SocialNetwork } from '../services/siteSettingsApi';
import { TikTokIcon } from '../components/ui/TikTokIcon';

const SOCIAL_ICONS: Record<SocialNetwork, React.ComponentType<{ size?: number; className?: string }>> = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: TikTokIcon,
  youtube: Youtube,
  linkedin: Linkedin,
  x: Twitter,
};

/**
 * The site's social accounts, managed in the backoffice (Réglages du site);
 * unset networks are left out. Shared by the footer and the login window so
 * both show the same links and icons.
 */
export function useSocialLinks() {
  const { data } = useQuery({
    queryKey: ['site-settings', 'social-links'],
    queryFn: ({ signal }) => siteSettingsApi.getSocialLinks(signal),
    staleTime: 1000 * 60 * 10,
  });
  return SOCIAL_NETWORKS
    .filter(({ key }) => typeof data?.[key] === 'string' && data[key])
    .map(({ key, label }) => ({ key, label, href: data![key] as string, Icon: SOCIAL_ICONS[key] }));
}
