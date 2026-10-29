import React from 'react';
import { TechSpec } from '../types';

export interface ComparisonRow {
  label: string;
  key: string;
  sub?: keyof TechSpec;
  better?: 'higher' | 'lower';
}

export interface ComparisonSection {
  group: string;
  icon: React.ElementType;
  rows: ComparisonRow[];
}

export const parseNumericValue = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  
  // Gère les prix ("34 500 DT"), puissances ("73.4 ch"), poids ("184 kg")
  return parseFloat(val.replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;
};

/**
 * Accède de manière sécurisée aux propriétés d'une spécification technique
 */
export const getSpecValue = (bike: TechSpec, row: ComparisonRow): string | number | undefined => {
  if (row.sub) {
    const subObj = bike[row.sub];
    if (subObj && typeof subObj === 'object') {
      // On utilise un cast contrôlé ici car les clés sont dynamiques par rapport au schéma
      return (subObj as Record<string, any>)[row.key];
    }
  }
  return (bike as Record<string, any>)[row.key];
};
