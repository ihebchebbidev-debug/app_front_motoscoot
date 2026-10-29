import React from 'react';

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'white' | 'gray' | 'none';
  containerSize?: 'default' | 'narrow' | 'wide';
}

/**
 * Section - Garant de la grille invisible du site.
 * Application du système de conteneur centré et équilibré.
 * Mobile: px-6 (24px) | Tablette: px-20 (80px) | Desktop: px-32 (128px)
 */
export const Section: React.FC<SectionProps> = ({ 
  children, 
  className = '', 
  variant = 'white',
  containerSize = 'default' 
}) => {
  const bgColors = {
    white: 'bg-card',
    gray: 'bg-gray-50',
    none: '',
  };

  const containerSizes = {
    narrow: 'max-w-5xl',
    default: 'max-w-[1440px]', 
    wide: 'max-w-full'
  };

  return (
    <section className={`${bgColors[variant]} ${className}`}>
      <div className={`mx-auto px-6 md:px-16 lg:px-32 ${containerSizes[containerSize]}`}>
        {children}
      </div>
    </section>
  );
};