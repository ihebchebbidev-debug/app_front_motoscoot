import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Navigation, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getOptimizedImageUrl, PLACEHOLDER_LISTING } from '../../utils/urlUtils';

interface ListingThumbnailProps {
  image: string;
  /** Toutes les photos de l'annonce (la première = `image`). */
  images?: string[];
  title: string;
  distance: number | null;
  isNear: boolean;
  favorited: boolean;
  onFavoriteToggle: () => void;
  viewMode: 'grid' | 'list';
  condition: string;
  priority?: boolean;
  isLoggedIn?: boolean;
  onTriggerLogin?: () => void;
  /** Whether this favorite is currently being toggled (loading state) */
  isToggling?: boolean;
}

/** Au-delà, la carte reste légère : la fiche annonce montre le reste. */
const MAX_SLIDES = 10;
/** Nombre de points visibles à la fois (fenêtre glissante, comme les apps marketplace). */
const MAX_DOTS = 5;

/**
 * ListingThumbnail — photo(s) d'une carte annonce des résultats de recherche.
 *
 * Plusieurs photos → petit carrousel :
 *  - téléphone / tablette : on glisse au doigt (défilement natif + scroll-snap), pas de flèches ;
 *  - ordinateur (souris) : deux petites flèches apparaissent au survol de la photo.
 * Seule la 1re photo est chargée au départ ; la suivante est montée au survol / au
 * premier toucher, les autres au fil de la navigation (aucun poids en plus au chargement).
 * Gère les erreurs de chargement d'image pour éviter les espaces vides.
 */
export const ListingThumbnail: React.FC<ListingThumbnailProps> = ({
  image,
  images,
  title,
  distance,
  isNear,
  favorited,
  onFavoriteToggle,
  viewMode,
  condition,
  priority = false,
  isLoggedIn = false,
  onTriggerLogin,
  isToggling = false,
}) => {
  const isGrid = viewMode === 'grid';

  const photos = useMemo(() => {
    const list = (Array.isArray(images) && images.length ? images : [image])
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .slice(0, MAX_SLIDES);
    return list.length ? list : [image];
  }, [images, image]);
  const count = photos.length;
  const multi = count > 1;

  const [active, setActive] = useState(0);
  // Index le plus loin dont l'<img> est montée (lazy-mount contrôlé).
  const [mountedUpTo, setMountedUpTo] = useState(0);
  const [failed, setFailed] = useState<Record<number, true>>({});
  const trackRef = useRef<HTMLDivElement>(null);

  const armNext = useCallback((upTo: number) => {
    setMountedUpTo((m) => (upTo > m ? Math.min(upTo, count - 1) : m));
  }, [count]);

  // Fluidité au doigt : AUCUN rendu React ni ajout d'image pendant le geste.
  // Toucher le contenu d'un conteneur scroll-snap en plein glissement relance
  // l'aimantation et coupe l'élan (le « ressenti de bug »). On met donc à jour
  // le point actif et on monte la photo suivante uniquement quand le défilement
  // est terminé : événement natif `scrollend`, sinon 120 ms sans défilement
  // (Safari ancien).
  useEffect(() => {
    const el = trackRef.current;
    if (!el || !multi) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if (timer) { clearTimeout(timer); timer = undefined; }
      if (!el.clientWidth) return;
      const idx = Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth)));
      setActive(idx);
      armNext(idx + 1);
    };
    const hasScrollEnd = 'onscrollend' in window;
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(settle, 120);
    };
    if (hasScrollEnd) el.addEventListener('scrollend', settle, { passive: true });
    else el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (timer) clearTimeout(timer);
      el.removeEventListener('scrollend', settle);
      el.removeEventListener('scroll', onScroll);
    };
  }, [multi, count, armNext]);

  const goTo = useCallback((idx: number) => {
    const el = trackRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(count - 1, idx));
    armNext(target + 1);
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: target * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  }, [count, armNext]);

  // Les flèches sont dans le lien de la carte : on bloque la navigation.
  const handleArrow = (e: React.MouseEvent, dir: -1 | 1) => {
    e.preventDefault();
    e.stopPropagation();
    goTo(active + dir);
  };

  const handleArrowKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
  };

  // Intention de voir la suite (survol souris, toucher) → la photo suivante est
  // montée AVANT que le doigt bouge, jamais pendant le glissement.
  const handleIntent = multi ? () => armNext(active + 1) : undefined;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      onTriggerLogin?.();
    } else {
      onFavoriteToggle();
    }
  };

  const seoAlt = `Photo moto d'occasion : ${title} - ${condition} en Tunisie`;
  const w = isGrid ? 400 : 300;
  const h = isGrid ? 300 : 225;

  const dotCount = Math.min(MAX_DOTS, count);
  const dotStart = Math.max(0, Math.min(active - Math.floor(MAX_DOTS / 2), count - dotCount));

  return (
    <div
      className={`group/photo relative flex-shrink-0 bg-card overflow-hidden isolate transform translate-z-0 ${
        isGrid
          ? 'w-full aspect-[4/3] rounded-t-[14px]'
          : 'w-full aspect-[16/9] rounded-t-[14px] md:rounded-t-none md:rounded-l-[14px] md:aspect-[4/3] lg:aspect-[4/3] lg:w-72'
      }`}
      onPointerEnter={handleIntent}
      onTouchStart={handleIntent}
    >
      <div
        ref={trackRef}
        data-carousel={multi ? '' : undefined}
        className={`flex h-full w-full ${
          multi ? 'overflow-x-auto overscroll-x-contain snap-x snap-mandatory no-scrollbar' : 'overflow-hidden'
        }`}
        {...(multi
          ? { role: 'group', 'aria-roledescription': 'carrousel', 'aria-label': `${count} photos : ${title}` }
          : {})}
      >
        {photos.map((src, i) => (
          <div
            key={i}
            className="relative h-full w-full flex-none snap-start snap-always bg-gray-100"
            {...(multi
              ? { role: 'group', 'aria-roledescription': 'photo', 'aria-label': `${i + 1} sur ${count}` }
              : {})}
          >
            {i <= mountedUpTo && (
              <img
                src={failed[i]
                  ? PLACEHOLDER_LISTING
                  : getOptimizedImageUrl(src, w, h, 80, PLACEHOLDER_LISTING, title)}
                alt={i === 0 ? seoAlt : `${seoAlt} (photo ${i + 1} sur ${count})`}
                loading={i === 0 && priority ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
                // @ts-ignore
                fetchPriority={i === 0 && priority ? 'high' : 'auto'}
                onError={() => setFailed((f) => (f[i] ? f : { ...f, [i]: true }))}
                className="w-full h-full object-cover select-none"
              />
            )}
          </div>
        ))}
      </div>

      {distance !== null && (
        <div className={`absolute left-0 top-0 z-20 px-3.5 py-2 rounded-br-2xl border-b border-r flex items-center gap-1.5 text-[12px] font-black uppercase tracking-tight shadow-sm ${
          isNear ? 'bg-primary-50 text-primary-600 border-primary-100' : 'bg-card/95 backdrop-blur-md text-gray-700 border-gray-100'
        }`}>
            <Navigation size={12} className={isNear ? 'text-white' : 'text-primary-500'} fill={isNear ? 'currentColor' : 'none'} />
            <span>{(distance >= 10 ? Math.round(distance).toString() : parseFloat(distance.toFixed(2)).toString())} km</span>
        </div>
      )}

      {multi && (
        <>
          {/* Flèches : souris uniquement (au toucher, on glisse). */}
          {active > 0 && (
            <button
              type="button"
              onClick={(e) => handleArrow(e, -1)}
              onKeyDown={handleArrowKey}
              aria-label="Photo précédente"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 hidden [@media(hover:hover)_and_(pointer:fine)]:flex w-8 h-8 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-md opacity-0 transition-[opacity,transform] duration-200 group-hover/photo:opacity-100 focus-visible:opacity-100 hover:bg-white hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <ChevronLeft size={18} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
          {active < count - 1 && (
            <button
              type="button"
              onClick={(e) => handleArrow(e, 1)}
              onKeyDown={handleArrowKey}
              aria-label="Photo suivante"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 hidden [@media(hover:hover)_and_(pointer:fine)]:flex w-8 h-8 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-md opacity-0 transition-[opacity,transform] duration-200 group-hover/photo:opacity-100 focus-visible:opacity-100 hover:bg-white hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}

          {/* Points : position réelle, fenêtre de 5 au plus. */}
          <div
            className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1.5 bg-black/30 backdrop-blur-md rounded-full z-20"
            aria-hidden="true"
          >
            {Array.from({ length: dotCount }, (_, k) => {
              const i = dotStart + k;
              const isEdge = (k === 0 && i > 0) || (k === dotCount - 1 && i < count - 1);
              return (
                <span
                  key={i}
                  className={`rounded-full transition-colors duration-200 ${
                    i === active ? 'bg-white' : 'bg-white/50'
                  } ${isEdge ? 'w-1 h-1' : 'w-1.5 h-1.5'}`}
                />
              );
            })}
          </div>
        </>
      )}

      <button
        onClick={handleFavoriteClick}
        disabled={isToggling}
        className={`absolute top-3 right-3 w-10 h-10 flex items-center justify-center backdrop-blur-md rounded-full transition-all active:scale-90 shadow-lg z-30 disabled:opacity-70 disabled:cursor-not-allowed ${
          favorited
            ? 'bg-red-500 text-white shadow-red-200/50 animate-heartbeat'
            : 'bg-card/90 text-gray-400 hover:text-red-500 border border-gray-100'
        }`}
        aria-label={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        {isToggling ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Heart size={18} fill={favorited ? "currentColor" : "none"} />
        )}
      </button>
    </div>
  );
};
