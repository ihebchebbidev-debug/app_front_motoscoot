
import { useMemo } from 'react';
import { FilterState } from './useListingFilters';
import { Listing } from '../types';
import { slugify } from '../utils/urlUtils';

export interface SEOData {
  displayTitle: string;
  metaDescription: string;
  /**
   * Self-referencing canonical for the current page:
   *  - Page 1 → `/annonces` (clean, no ?page=) or `/annonces/{brand}[/{model}]`
   *  - Page N>1 → same base path with `?page=N`
   * Google's current guidance: each paginated page self-canonicalizes so
   * deep results stay discoverable, while `noindex,follow` (set in the
   * SEO component for page>1) keeps duplicates out of the index.
   */
  canonicalPath: string;
  /** rel="prev" target for the previous page, when applicable. */
  prevPath?: string;
  /** rel="next" target for the next page, when applicable. */
  nextPath?: string;
  schemas: any[];
}

/**
 * Hook useSearchSEO - Orchestre la logique de métadonnées pour la page de recherche.
 * Centralise la génération sémantique des titres + canonicals + pagination.
 */
export const useSearchSEO = (
  filters: FilterState,
  results: Listing[],
  userLocation: { lat: number; lng: number } | null,
  pagination?: { currentPage: number; totalPages: number }
): SEOData => {
  return useMemo(() => {
    const brand = filters.brand && filters.brand !== 'Toutes les marques' ? filters.brand : '';
    const model = filters.model && filters.model !== 'Tous les modèles' ? filters.model : '';
    const location = filters.location ? filters.location : (userLocation ? 'Autour de moi' : 'Tunisie');
    const type = filters.type && filters.type !== 'Tous les types' ? filters.type : 'Moto & Scooter';

    const currentPage = Math.max(1, pagination?.currentPage || 1);
    const totalPages = Math.max(1, pagination?.totalPages || 1);

    // Titre H1 / Meta Title — préfixé "Page N" pour différencier les paginations.
    const baseTitle = brand
      ? `${brand} ${model} d'occasion à ${location}`
      : `${type} d'occasion en Tunisie`;
    const displayTitle = currentPage > 1 ? `${baseTitle} — Page ${currentPage}` : baseTitle;

    const metaDescription = currentPage > 1
      ? `Page ${currentPage} sur ${totalPages} — annonces de ${brand || 'motos et scooters'} ${model} à ${location} sur moto-scoot.tn.`
      : `Découvrez ${results.length} annonces de ${brand} ${model} disponibles à ${location}. moto-scoot.tn : la référence pour votre achat moto en Tunisie.`;

    // Clean base path (no query string).
    const SITE = 'https://www.moto-scoot.tn';
    let basePath = '/annonces';
    if (brand) basePath += `/${slugify(brand)}`;
    if (model) basePath += `/${slugify(model)}`;

    // Self-canonical: page 1 omits `?page=`, page N>1 carries it.
    const pagedPath = (p: number) => (p <= 1 ? basePath : `${basePath}?page=${p}`);
    const canonicalPath = pagedPath(currentPage);
    const prevPath = currentPage > 1 ? pagedPath(currentPage - 1) : undefined;
    const nextPath = currentPage < totalPages ? pagedPath(currentPage + 1) : undefined;

    // BreadcrumbList (always points to canonical, page-less ancestors).
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": `${SITE}/` },
        { "@type": "ListItem", "position": 2, "name": "Annonces", "item": `${SITE}/annonces` },
        brand ? { "@type": "ListItem", "position": 3, "name": brand, "item": `${SITE}/annonces/${slugify(brand)}` } : null
      ].filter(Boolean)
    };

    const itemListSchema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": displayTitle,
      "numberOfItems": results.length,
      "itemListElement": results.slice(0, 10).map((l, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "url": `${SITE}/annonce/${slugify(l.title)}-${l.id}`,
        "name": l.title
      }))
    };

    return {
      displayTitle,
      metaDescription,
      canonicalPath,
      prevPath,
      nextPath,
      schemas: [breadcrumbSchema, itemListSchema]
    };
  }, [filters, results, userLocation, pagination?.currentPage, pagination?.totalPages]);
};
