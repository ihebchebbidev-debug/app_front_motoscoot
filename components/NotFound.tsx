import React from 'react';
import { ArrowLeft } from 'lucide-react';
import SEO from './common/SEO';
import { Button } from './ui/Button';
import type { BasePageProps } from '../types';

export default function NotFound({ onGoHome }: BasePageProps) {
  return <main className="max-w-3xl mx-auto px-6 py-24 min-h-[60vh]">
    <SEO title="Page introuvable | MotoScoot.tn" description="Cette adresse ne correspond à aucune page MotoScoot." noIndex />
    <h1 className="text-3xl font-bold text-foreground mb-4">Page introuvable</h1>
    <p className="text-muted-foreground mb-8">Cette page n’existe pas ou a été supprimée.</p>
    <Button onClick={onGoHome} leftIcon={<ArrowLeft size={18} />}>Retour à l’accueil</Button>
  </main>;
}