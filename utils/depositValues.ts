/**
 * The empty listing form: one definition for the first render, « Réinitialiser »,
 * « Déposer une autre annonce » and the draft restore.
 *
 * Every field of the schema (types/listing.ts) is here, so a reset clears all
 * of them (the accessory fields were missing, so a « Pointure » or an « Antivol »
 * survived a reset).
 *
 * Why the reset passes these values instead of calling reset() bare: in
 * react-hook-form, reset(values) also makes `values` the new defaults. The
 * draft restore did reset(draft), so a later bare reset() went back to the
 * draft: « Réinitialiser » brought the old listing back (and the autosave kept
 * it). The restore now keeps these defaults (keepDefaultValues).
 */
export const emptyDepositValues = () => ({
  category: undefined as unknown as 'Moto',
  brand: '',
  model: '',
  condition: '',
  year: '',
  mileage: '',
  cc: '',
  equipment: [] as string[],
  price: '',
  city: '',
  governorate: '',
  phone: '',
  contactMethod: 'phone' as const,
  description: '',
  images: [] as string[],
  address: '',
  latitude: undefined as unknown as number,
  longitude: undefined as unknown as number,
  accessoryType: '',
  helmetType: '',
  visorType: [] as string[],
  size: '',
  gender: '',
  shoeSize: '',
  antiTheftType: '',
  intercomFeatures: [] as string[],
});

/** A saved draft on top of the empty form: a field the draft lacks starts empty. */
export const draftOverEmpty = (saved: Record<string, unknown> | null | undefined) => ({
  ...emptyDepositValues(),
  ...(saved && typeof saved === 'object' ? saved : {}),
});
