/**
 * Ordering rules for the admin image gallery (AdminGalleryUpload).
 *
 * The gallery is a plain list of URLs. Drag and drop needs a stable id per
 * image: the URL itself, with a suffix when the same URL appears twice, so
 * two copies never share an id.
 */
import { movePhoto } from './depositPhotos';

/** One stable, unique id per image, in the same order as `urls`. */
export function galleryItemIds(urls: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return urls.map((url) => {
    const n = (seen.get(url) ?? 0) + 1;
    seen.set(url, n);
    return n === 1 ? url : `${url}#${n}`;
  });
}

/** Moves the image dragged (`activeId`) to the place of the one under it (`overId`). */
export function reorderGallery(urls: readonly string[], activeId: string, overId: string | null | undefined): string[] {
  if (!overId || activeId === overId) return [...urls];
  const ids = galleryItemIds(urls);
  return movePhoto(urls, ids.indexOf(activeId), ids.indexOf(overId));
}

/** Moves the image at `index` one place left (-1) or right (+1): the ← → buttons. */
export function moveGalleryItem(urls: readonly string[], index: number, delta: -1 | 1): string[] {
  return movePhoto(urls, index, index + delta);
}

/** 1-based position of an image id, for screen-reader messages (0 if unknown). */
export function galleryPosition(urls: readonly string[], id: unknown): number {
  return galleryItemIds(urls).indexOf(String(id)) + 1;
}

/** French screen-reader texts for drag and drop (mouse, touch and keyboard). */
export const GALLERY_DND_INSTRUCTIONS =
  "Pour changer l'ordre des images : appuyez sur Espace ou Entrée pour saisir l'image, " +
  'déplacez-la avec les flèches, puis Espace ou Entrée pour la déposer, ou Échap pour annuler.';

export function galleryAnnouncements(getUrls: () => readonly string[]) {
  const total = () => getUrls().length;
  const pos = (id: unknown) => galleryPosition(getUrls(), id);
  return {
    onDragStart: ({ active }: { active: { id: unknown } }) =>
      `Image ${pos(active.id)} sur ${total()} saisie.`,
    onDragOver: ({ active, over }: { active: { id: unknown }; over: { id: unknown } | null }) =>
      over ? `Image ${pos(active.id)} au-dessus de la position ${pos(over.id)} sur ${total()}.` : "L'image n'est plus au-dessus de la galerie.",
    onDragEnd: ({ active, over }: { active: { id: unknown }; over: { id: unknown } | null }) =>
      over ? `Image ${pos(active.id)} déposée en position ${pos(over.id)} sur ${total()}.` : 'Image déposée hors de la galerie, ordre inchangé.',
    onDragCancel: ({ active }: { active: { id: unknown } }) =>
      `Déplacement annulé. L'image ${pos(active.id)} reste à sa place.`,
  };
}
