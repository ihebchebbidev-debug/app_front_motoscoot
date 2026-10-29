import React from 'react';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

interface RevealProps {
  children: React.ReactNode;
  animation?: 'fade-in-up' | 'fade-in-left' | 'fade-in-right' | 'scale-in';
  delay?: number;
  duration?: number;
  className?: string;
}

/**
 * Reveal - Wrapper pour micro-interactions au scroll.
 * Parfait pour dynamiser les grilles d'annonces.
 */
export const Reveal: React.FC<RevealProps> = ({ 
  children, 
  animation = 'fade-in-up', 
  delay = 0, 
  duration = 700,
  className = ''
}) => {
  const { elementRef, isVisible } = useIntersectionObserver();

  const animationStyles = {
    'fade-in-up': isVisible 
      ? 'opacity-100 translate-y-0' 
      : 'opacity-0 translate-y-8',
    'fade-in-left': isVisible 
      ? 'opacity-100 translate-x-0' 
      : 'opacity-0 -translate-x-8',
    'fade-in-right': isVisible 
      ? 'opacity-100 translate-x-0' 
      : 'opacity-0 translate-x-8',
    'scale-in': isVisible 
      ? 'opacity-100 scale-100' 
      : 'opacity-0 scale-95',
  };

  return (
    <div
      // @ts-ignore - elementRef est typé de manière générique
      ref={elementRef}
      className={`transition-all ${className} ${animationStyles[animation]}`}
      style={{ 
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {children}
    </div>
  );
};