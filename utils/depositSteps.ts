/**
 * Order of the "Déposer une annonce" wizard. Photos come first: it is the
 * most motivating gesture and does not depend on any other answer (the same
 * opening as Vinted or Leboncoin's app). The category is the first field of
 * the technical step, and the seller checks everything on a recap before
 * publishing. Accessories have no equipment step.
 */
export type DepositStepId = 'photos' | 'technical' | 'equipment' | 'details' | 'recap';

const VEHICLE_STEPS: DepositStepId[] = ['photos', 'technical', 'equipment', 'details', 'recap'];
const ACCESSORY_STEPS: DepositStepId[] = ['photos', 'technical', 'details', 'recap'];

export const MAX_DEPOSIT_STEPS = VEHICLE_STEPS.length;

/** Categories accepted by the listing form (types/listing.ts schema). */
export const DEPOSIT_CATEGORIES = ['Moto', 'Scooter', 'Quad', 'Accessoires'] as const;

export const depositSteps = (isAccessory: boolean): DepositStepId[] =>
  isAccessory ? ACCESSORY_STEPS : VEHICLE_STEPS;

/** Step id at a 1-based step number (clamped to the last step). */
export const depositStepAt = (step: number, isAccessory: boolean): DepositStepId => {
  const steps = depositSteps(isAccessory);
  return steps[Math.min(Math.max(step, 1), steps.length) - 1];
};

/** 1-based step number of a step id (0 when the step does not exist). */
export const depositStepNumber = (id: DepositStepId, isAccessory: boolean): number =>
  depositSteps(isAccessory).indexOf(id) + 1;

export const depositStepLabel = (id: DepositStepId, isAccessory: boolean): string =>
  ({
    photos: 'Photos',
    technical: isAccessory ? 'Spécifications accessoire' : 'Données techniques',
    equipment: 'Équipements',
    details: 'Prix et description',
    recap: 'Récapitulatif',
  })[id];
