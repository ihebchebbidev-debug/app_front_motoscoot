import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Heart, Share2 } from 'lucide-react';

import { getOptimizedImageUrl, PLACEHOLDER_LISTING } from '../../utils/urlUtils';
import { Button } from '../ui/Button';

interface ListingGalleryProps {
  images: string[];
  title: string;
  brand?: string;
  model?: string;
  favorited: boolean;
  onFavoriteToggle: (e?: React.MouseEvent) => void;
  onShare?: () => void;
  showFavorite?: boolean;
  overlayTopLeft?: React.ReactNode;
}

const S = {
  GalleryMain: "relative aspect-[4/3] md:aspect-video rounded-2xl overflow-hidden bg-card group shadow-md select-none md:cursor-zoom-in transition-transform active:scale-[0.99] touch-pan-y",
  GalleryNav: "absolute inset-y-0 hidden md:flex items-center justify-between px-3 w-full pointer-events-none z-20",
  GalleryBtn: "w-10 h-10 md:w-12 md:h-12 bg-card/90 backdrop-blur-md rounded-full text-gray-900 shadow-xl pointer-events-auto active:scale-90 transition-all hover:bg-card flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100",
  ThumbsWrapper: "hidden md:flex gap-2.5 mt-4 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory",
  Thumb: (active: boolean) => `
    relative flex-shrink-0 w-20 h-14 md:w-28 md:h-20 rounded-xl overflow-hidden border-2 transition-all cursor-pointer snap-start
    ${active 
      ? 'border-primary-600 ring-2 ring-orange-50 scale-[0.98]' 
      : 'border-transparent opacity-60 hover:opacity-100'}
  `,
  Counter: "absolute bottom-4 right-4 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-lg text-white text-[12px] font-extrabold uppercase tracking-widest border border-white/10 z-20",
  DotPagination: "absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 md:hidden",
  Dot: (active: boolean) => `w-1.5 h-1.5 rounded-full transition-all duration-300 ${active ? 'bg-card w-4' : 'bg-white/40'}`,
  
  OverlayActionBtn: "w-11 h-11 md:w-12 md:h-12 bg-white/70 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] rounded-full transition-all duration-300 active:scale-90 flex items-center justify-center group/btn",
  
  FullscreenWrapper: "fixed inset-0 z-[500] bg-neutral-950 flex flex-col items-center justify-center animate-fade-in touch-none select-none",
  TheaterHeader: "absolute top-0 left-0 right-0 z-[520] p-6 md:p-8 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent",
  HeaderInfo: "flex flex-col gap-1 pr-4 hidden md:flex",
  TheaterTitle: "text-primary-600 text-lg md:text-2xl font-black tracking-tight drop-shadow-sm",
  TheaterCounter: "text-white/40 text-[12px] md:text-xs font-bold uppercase tracking-widest",
  CloseBtn: "w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all active:scale-90 border border-white/10 shadow-xl",
  ImageContainer: "relative w-full h-full flex items-center justify-center overflow-hidden p-4 md:p-12",
  TheaterImg: "w-full h-full object-contain transition-all duration-500 animate-scale-in",
  NavArrow: (side: 'left' | 'right') => `absolute top-1/2 -translate-y-1/2 ${side === 'left' ? 'left-6' : 'right-6'} z-[530] hidden md:flex w-16 h-16 items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white transition-all active:scale-90 border border-white/5 backdrop-blur-sm group`,

  MobileTitleCard: "absolute bottom-0 left-0 right-0 z-[520] p-6 md:hidden bg-card/95 backdrop-blur-md rounded-t-[2rem] flex flex-col items-start shadow-[0_-10px_30px_rgba(0,0,0,0.1)] border-t border-gray-100",
  MobileBrand: "text-primary-600 font-bold text-[14px] leading-none mb-1 tracking-[0px] font-sans",
  MobileModel: "text-foreground font-extrabold text-[24px] leading-tight tracking-[0px] font-sans",
  BottomRail: "absolute bottom-8 left-0 right-0 z-[520] hidden md:flex flex-col items-center gap-4 animate-fade-in"
};

export const ListingGallery: React.FC<ListingGalleryProps> = ({ 
  images, 
  title, 
  brand,
  model,
  favorited, 
  onFavoriteToggle, 
  onShare,
  showFavorite = true,
  overlayTopLeft
}) => {
  const [activeImg, setActiveImg] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const galleryKey = images.join('|');
  useEffect(() => { setActiveImg(0); }, [galleryKey]);
  const activeIndex = Math.min(activeImg, Math.max(0, images.length - 1));
  const activeSource = images[activeIndex] || PLACEHOLDER_LISTING;
  const imageFallback = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.dataset.fallback) return;
    e.currentTarget.dataset.fallback = 'true';
    e.currentTarget.src = PLACEHOLDER_LISTING;
  };
  useEffect(() => {
    if (!isFullscreen) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { document.body.style.overflow = overflow; returnFocus.current?.focus(); };
  }, [isFullscreen]);
  
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (touchStart.current === null || touchEnd.current === null) return;
    const distance = touchStart.current - touchEnd.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) nextImg();
    if (isRightSwipe) prevImg();
  };

  const nextImg = useCallback(() => {
    setActiveImg((prev) => images.length ? (prev + 1) % images.length : 0);
  }, [images.length]);

  const prevImg = useCallback(() => {
    setActiveImg((prev) => images.length ? (prev - 1 + images.length) % images.length : 0);
  }, [images.length]);

  // Keyboard navigation works always — not only in fullscreen — so power
  // users can browse photos with ←/→. Esc closes fullscreen when open.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when the user is typing in an input/textarea.
      const t = e.target as HTMLElement | null;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      if (!isFullscreen && !galleryRef.current?.contains(t)) return;
      if (isFullscreen && e.key === 'Tab') {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || []).filter(button => button.getClientRects().length > 0);
        const first = buttons[0]; const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
      if (e.key === 'Escape' && isFullscreen) { setIsFullscreen(false); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); nextImg(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prevImg(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, nextImg, prevImg]);

  // Pinch-to-zoom support for the fullscreen view on mobile.
  // Tracks two-finger distance, scales the image up to 4x, and resets when
  // the user closes the lightbox or swipes to a different photo.
  const [zoomScale, setZoomScale] = useState(1);
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartScale = useRef(1);
  useEffect(() => { setZoomScale(1); }, [activeImg, isFullscreen]);

  const onPinchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartScale.current = zoomScale;
    }
  };
  const onPinchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const next = Math.max(1, Math.min(4, pinchStartScale.current * (dist / pinchStartDist.current)));
      setZoomScale(next);
    }
  };
  const onPinchEnd = () => { pinchStartDist.current = null; };

  return (
    <div ref={galleryRef} className="relative font-sans">
      <div className="w-full">
        <div 
          className={S.GalleryMain} 
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <Button variant="ghost" className="absolute inset-0 w-full h-full p-0" aria-label="Ouvrir les photos en plein écran" onClick={() => setIsFullscreen(true)} />
          <img
            key={activeSource}
            onError={imageFallback}
            src={getOptimizedImageUrl(activeSource, 1200, 900, 90, undefined, title)}
            className="w-full h-full object-cover animate-fade-in pointer-events-none" 
            alt={title}
            loading="eager"
          />
          
          <div className={S.Counter}>{images.length ? activeIndex + 1 : 0} / {images.length}</div>
          {images.length > 1 && <div className={S.GalleryNav}>
            <Button variant="ghost" aria-label="Photo précédente" className={S.GalleryBtn} onClick={prevImg}><ChevronLeft /></Button>
            <Button variant="ghost" aria-label="Photo suivante" className={S.GalleryBtn} onClick={nextImg}><ChevronRight /></Button>
          </div>}
          
          {images.length > 1 && (
            <div className={S.DotPagination}>
              {images.map((_, idx) => (
                <div key={idx} className={S.Dot(activeImg === idx)} />
              ))}
            </div>
          )}
          

          {overlayTopLeft && (
            <div className="absolute top-4 left-4 z-30">
              {overlayTopLeft}
            </div>
          )}

          <div className="absolute top-4 right-4 z-30 flex items-center gap-3">
            <button 
              onClick={(e) => { e.stopPropagation(); onShare?.(); }} 
              className={`${S.OverlayActionBtn} hover:bg-card/90`}
              aria-label="Partager l'annonce"
            >
              <Share2 size={20} strokeWidth={2.5} className="text-gray-900 group-hover/btn:text-primary-600 transition-colors" />
            </button>

            {showFavorite && (
              <button 
                onClick={(e) => { e.stopPropagation(); onFavoriteToggle(e); }} 
                className={`${S.OverlayActionBtn} hover:bg-card/90`}
                aria-label={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <Heart 
                  size={20} 
                  strokeWidth={2.5} 
                  fill={favorited ? "hsl(var(--destructive))" : "none"} 
                  className={`transition-all duration-300 ${favorited ? 'text-red-500 scale-110 animate-heartbeat' : 'text-gray-900 group-hover/btn:text-red-500'}`} 
                />
              </button>
            )}
          </div>
        </div>

        {images.length > 1 && !isFullscreen && (
          <div className={S.ThumbsWrapper}>
            {images.map((img, idx) => (
              <button key={img} aria-label={`Afficher la photo ${idx + 1}`} className={S.Thumb(activeIndex === idx)} onClick={() => setActiveImg(idx)}>
                <img onError={imageFallback} src={getOptimizedImageUrl(img, 200, 150, 70, undefined, title)} className="w-full h-full object-cover" alt="" />
              </button>
            ))}
          </div>
        )}
      </div>

      {isFullscreen && typeof document !== 'undefined' && createPortal(
        <div 
          ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Photos de ${title}`}
          className={S.FullscreenWrapper}
          onTouchStart={(e) => { onPinchStart(e); if (e.touches.length === 1) onTouchStart(e); }}
          onTouchMove={(e) => { onPinchMove(e); if (e.touches.length === 1 && zoomScale === 1) onTouchMove(e); }}
          onTouchEnd={(e) => { onPinchEnd(); if (zoomScale === 1) onTouchEnd(); }}
        >
          <div className={S.TheaterHeader}>
             <div className={S.HeaderInfo}>
                <h2 className={S.TheaterTitle}>{title}</h2>
                <div className={S.TheaterCounter}>
                  Photo {activeImg + 1} / {images.length}
                  {zoomScale > 1 && <span className="ml-2 text-primary-400">· Zoom {zoomScale.toFixed(1)}x</span>}
                </div>
             </div>
             <button 
               onClick={() => setIsFullscreen(false)} 
               className={S.CloseBtn}
               aria-label="Fermer"
             >
                <X className="w-5 h-5 md:w-7 md:h-7" strokeWidth={3} />
             </button>
          </div>

          {images.length > 1 && (
            <>
              <button aria-label="Photo précédente" onClick={(e) => { e.stopPropagation(); prevImg(); }} className={S.NavArrow('left')}>
                <ChevronLeft size={40} strokeWidth={2.5} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <button aria-label="Photo suivante" onClick={(e) => { e.stopPropagation(); nextImg(); }} className={S.NavArrow('right')}>
                <ChevronRight size={40} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </>
          )}

          <div className={S.ImageContainer} onClick={() => zoomScale === 1 && setIsFullscreen(false)}>
            <img
              key={`fs-${activeSource}`}
              onError={imageFallback}
              src={activeSource}
              className={S.TheaterImg}
              alt={title}
              loading="eager"
              draggable={false}
              style={{ transform: `scale(${zoomScale})`, transition: pinchStartDist.current ? 'none' : 'transform 0.2s ease-out' }}
              onDoubleClick={(e) => { e.stopPropagation(); setZoomScale(s => s > 1 ? 1 : 2); }}
            />
          </div>

          {images.length > 1 && (
            <div className={S.BottomRail}>
               <div className="flex gap-2.5 max-w-[80vw] overflow-x-auto no-scrollbar px-10 py-4">
                  {images.map((img, idx) => (
                    <button key={img} aria-label={`Afficher la photo ${idx + 1}`} onClick={(e) => { e.stopPropagation(); setActiveImg(idx); }} className={`w-16 h-12 md:w-20 md:h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${activeIndex === idx ? 'border-orange-500 scale-110 shadow-2xl' : 'border-white/10 opacity-30 hover:opacity-100 hover:scale-105'}`}>
                      <img onError={imageFallback} src={getOptimizedImageUrl(img, 200, 150, 80, undefined, title)} className="w-full h-full object-cover" alt="" />
                    </button>
                  ))}
               </div>
            </div>
          )}

          <div className={S.MobileTitleCard}>
             <span className={S.MobileBrand}>{brand}</span>
             <h2 className={S.MobileModel}>{model}</h2>
             <div className="flex items-end justify-between w-full mt-4">
                <span className="text-gray-400 text-[9px] font-bold uppercase tracking-widest">Photo {activeImg + 1} / {images.length}</span>
                {images.length > 1 && (
                   <div className="flex flex-col items-center -mt-20 mr-1">
                      <img src="/hand-swipe.svg" alt="" aria-hidden="true" className="w-24 h-24 pointer-events-none" draggable={false} />
                      <span className="text-gray-300 text-[9px] font-bold uppercase tracking-[0.2em] -mt-4">Glissez pour naviguer</span>
                   </div>
                )}
             </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
