/** Texte du bouton du bas de la feuille Filtres (téléphone), avec le bon pluriel. */
export function resultsButtonLabel(count: number): string {
  if (!count || count < 0) return 'Aucune annonce';
  if (count === 1) return 'Voir 1 annonce';
  return `Voir ${count.toLocaleString('fr-FR')} annonces`;
}
