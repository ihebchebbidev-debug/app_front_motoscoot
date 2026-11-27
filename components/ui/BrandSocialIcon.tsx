import React, { useId } from 'react';
import { siFacebook, siInstagram, siTiktok } from 'simple-icons';
import type { SocialNetwork } from '../../services/siteSettingsApi';

/**
 * The real logos of the site's social networks (Simple Icons, CC0), filled
 * and in their own colours — as in the share window (SocialShareModal):
 * Facebook blue, Instagram's gradient, TikTok black with its cyan / pink
 * offsets. Networks without a brand logo here return null (the caller can
 * fall back to a plain icon).
 */
export const BrandSocialIcon: React.FC<{ network: SocialNetwork; size?: number }> = ({ network, size = 22 }) => {
  const gradientId = useId();
  const common = { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, focusable: false } as const;

  if (network === 'facebook') {
    return (
      <svg {...common}>
        <path d={siFacebook.path} fill={`#${siFacebook.hex}`} />
      </svg>
    );
  }
  if (network === 'instagram') {
    return (
      <svg {...common}>
        <defs>
          {/* Instagram's own gradient, yellow at the bottom left to purple. */}
          <radialGradient id={gradientId} cx="0.3" cy="1.07" r="1.2">
            <stop offset="0" stopColor="#FDDB78" />
            <stop offset="0.2" stopColor="#FD9B3A" />
            <stop offset="0.45" stopColor="#F2295B" />
            <stop offset="0.7" stopColor="#C8329F" />
            <stop offset="1" stopColor="#6C47D9" />
          </radialGradient>
        </defs>
        <path d={siInstagram.path} fill={`url(#${gradientId})`} />
      </svg>
    );
  }
  if (network === 'tiktok') {
    return (
      <svg {...common}>
        {/* TikTok's cyan and pink offsets behind the black note. */}
        <path d={siTiktok.path} fill="#25F4EE" transform="translate(-0.6 -0.6)" />
        <path d={siTiktok.path} fill="#FE2C55" transform="translate(0.6 0.6)" />
        <path d={siTiktok.path} fill="#000000" />
      </svg>
    );
  }
  return null;
};
