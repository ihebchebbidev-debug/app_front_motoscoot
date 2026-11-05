/**
 * Order of the "Déposer une annonce" wizard. Photos come first: it is the
 * most motivating gesture and does not depend on any other answer (the same
 * opening as Vinted or Leboncoin's app). Accessories have no equipment step.
 */
export type DepositStepId = 'photos' | 'category' | 'technical' | 'equipment' | 'publish' | 'location';

const VEHICLE_STEPS: DepositStepId[] = ['photos', 'category', 'technical', 'equipment', 'publish', 'location'];
const ACCESSORY_STEPS: DepositStepId[] = ['photos', 'category', 'technical', 'publish', 'location'];

export const MAX_DEPOSIT_STEPS = VEHICLE_STEPS.length;

export const depositSteps = (isAccessory: boolean): DepositStepId[] =>
  isAccessory ? ACCESSORY_STEPS : VEHICLE_STEPS;

/** Step id at a 1-based step number (clamped to the last step). */
export const depositStepAt = (step: number, isAccessory: boolean): DepositStepId => {
  const steps = depositSteps(isAccessory);
  return steps[Math.min(Math.max(step, 1), steps.length) - 1];
};

/** 1-based step number of a step id. */
export const depositStepNumber = (id: DepositStepId, isAccessory: boolean): number =>
  depositSteps(isAccessory).indexOf(id) + 1;

export const depositStepLabel = (id: DepositStepId, isAccessory: boolean): string =>
  ({
    photos: 'Photos',
    category: 'Catégorie',
    technical: isAccessory ? 'Spécifications accessoire' : 'Spécifications techniques',
    equipment: 'Équipements',
    publish: 'Publication',
    location: 'Localisation',
  })[id];
