import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';
import { useTechSpecsBrands, useTechSpecsByBrand } from '../../hooks/useTechSpecs';
import { catalogBrand, listingCatalogLinks, LISTING_CATALOG_HEADING } from '../../utils/listingCatalogLinks';

/**
 * « Fiche technique et prix du neuf » on a listing (SEO audit 2026-11-19, H3):
 * the fiche of the same model when the catalogue has it, and every fiche of
 * the brand. Real links, the same as in the HTML Google receives
 * (api/og-listing.ts). Nothing shown when the brand has no catalogue page.
 */
export const ListingCatalogLinks: React.FC<{
  brand?: string | null;
  model?: string | null;
  blockClassName: string;
  bodyClassName: string;
}> = ({ brand, model, blockClassName, bodyClassName }) => {
  const { data: brands = [] } = useTechSpecsBrands();
  const known = catalogBrand(brand, brands);
  const { data: specs = [], isLoading } = useTechSpecsByBrand(known ?? undefined);
  const links = useMemo(() => listingCatalogLinks({ brand, model }, brands, specs), [brand, model, brands, specs]);

  // Wait for the brand's sheets so the block does not change once shown.
  if (!known || isLoading || !links.length) return null;

  return (
    <section className={blockClassName} aria-labelledby="annonce-catalogue">
      <div className="flex items-stretch border-b border-gray-50/50 h-14 md:h-16">
        <div className="w-[12%] md:w-[49px] flex items-center justify-center border-r border-gray-100 bg-gray-50/20 shrink-0">
          <BookOpen size={22} className="text-primary-600" strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div className="flex-1 flex items-center px-[10px] md:px-[14px]">
          <h2 id="annonce-catalogue" className="font-sans text-[16px] font-extrabold text-foreground">{LISTING_CATALOG_HEADING}</h2>
        </div>
      </div>
      <div className={bodyClassName}>
        <ul className="flex flex-col gap-2">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                to={l.href}
                className="group flex items-center justify-between gap-3 min-h-11 px-4 rounded-xl border border-gray-100 bg-muted text-[15px] font-semibold text-foreground transition-colors duration-100 active:scale-[0.98] [@media(hover:hover)]:hover:border-primary-200 [@media(hover:hover)]:hover:text-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-900"
              >
                <span className="min-w-0 truncate">{l.label}</span>
                <ChevronRight size={18} className="shrink-0 text-gray-400 [@media(hover:hover)]:group-hover:text-primary-700" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
