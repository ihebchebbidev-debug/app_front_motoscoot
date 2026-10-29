import React, { useMemo } from 'react';

/* ---------- Default icon set ----------
 * Used when the admin hasn't attached an `icon_url` to a category/accessory
 * type yet. Keyed by canonical name so newly added rows fall back to a
 * sensible default until an admin uploads a custom icon. */
const DEFAULT_ICONS: Record<string, string> = {
  Moto: 'https://www.magma-studio.tn/portfolio2/moto/icons/moto.svg',
  Scooter: 'https://www.magma-studio.tn/portfolio2/moto/icons/scooter.svg',
  Quad: 'https://www.magma-studio.tn/portfolio2/moto/icons/quad.svg',
  Accessoires: 'https://www.magma-studio.tn/portfolio2/moto/icons/accesoires.svg',
  Casque: 'https://www.magma-studio.tn/portfolio2/moto/icons/casques.svg',
  Casques: 'https://www.magma-studio.tn/portfolio2/moto/icons/casques.svg',
  Veste: 'https://www.magma-studio.tn/portfolio2/moto/icons/vestes.svg',
  Vestes: 'https://www.magma-studio.tn/portfolio2/moto/icons/vestes.svg',
  Gant: 'https://www.magma-studio.tn/portfolio2/moto/icons/gants.svg',
  Gants: 'https://www.magma-studio.tn/portfolio2/moto/icons/gants.svg',
};

const FALLBACK_ICON = 'https://www.magma-studio.tn/portfolio2/moto/icons/moto.svg';

/* Static, non-dynamic category strip. Admin reference data does NOT
 * affect this list — edit the array below to change it. */
const STATIC_NAV: { label: string }[] = [
  { label: 'Moto' },
  { label: 'Scooter' },
  { label: 'Quad' },
  { label: 'Accessoires' },
  { label: 'Casque' },
  { label: 'Gant' },
  { label: 'Veste' },
];

interface CategoryNavProps {
  onCategoryClick: (label: string) => void;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({ onCategoryClick }) => {
  const items = useMemo(
    () =>
      STATIC_NAV.map((n) => ({
        label: n.label,
        icon: DEFAULT_ICONS[n.label] || FALLBACK_ICON,
      })),
    [],
  );

  return (
    <div className="w-full overflow-x-auto no-scrollbar pb-6 md:pb-2 flex-shrink-0 px-6 md:px-0">
      <div className="flex flex-nowrap md:justify-center gap-6 md:gap-10 w-full min-w-max md:min-w-0 py-2">
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            onClick={() => onCategoryClick(item.label)}
            className="flex flex-col items-center group cursor-pointer opacity-0 animate-fade-in-up flex-shrink-0"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110 will-change-transform">
              <img
                src={item.icon}
                alt={item.label}
                className="w-8 h-8 md:w-10 md:h-10 transition-transform duration-300"
                loading="lazy"
              />
            </div>
            <span className="text-white font-semibold text-[11px] md:text-sm tracking-wide">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
