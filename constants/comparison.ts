import { Zap, Cpu, Settings2, Ruler } from 'lucide-react';
import { ComparisonSection } from '../utils/comparisonUtils';

export const COMPARISON_SCHEMA: ComparisonSection[] = [
  { group: "Motorisation", icon: Zap, rows: [
    { label: "Moteur", key: "type", sub: "engine" },
    { label: "Cylindrée", key: "cc", sub: "engine" },
    { label: "Puissance", key: "power", sub: "engine" },
    { label: "Couple", key: "torque", sub: "engine" },
    { label: "Refroidissement", key: "cooling", sub: "engine" },
    { label: "Boîte", key: "transmission", sub: "engine" },
    { label: "Vitesse max", key: "topSpeed", better: "higher" },
  ]},
  { group: "Options", icon: Cpu, rows: [
    { label: "ABS", key: "abs", sub: "electronics" },
    { label: "Traction Control", key: "tcs", sub: "electronics" },
    { label: "Quickshifter", key: "quickshifter", sub: "electronics" },
    { label: "Modes de conduite", key: "ridingModes", sub: "electronics" },
  ]},
  { group: "Partie-Cycle", icon: Settings2, rows: [
    { label: "Suspension avant", key: "suspensionFront", sub: "chassis" },
    { label: "Débattement avant", key: "travelFront", sub: "chassis" },
    { label: "Suspension arrière", key: "suspensionRear", sub: "chassis" },
    { label: "Débattement arrière", key: "travelRear", sub: "chassis" },
    { label: "Frein avant", key: "brakesFront", sub: "chassis" },
    { label: "Frein arrière", key: "brakesRear", sub: "chassis" },
    { label: "Pneu avant", key: "tireFront", sub: "chassis" },
    { label: "Pneu arrière", key: "tireRear", sub: "chassis" },
  ]},
  { group: "Mensurations", icon: Ruler, rows: [
    { label: "Poids", key: "weight", sub: "dimensions", better: "lower" },
    { label: "Hauteur de selle", key: "seatHeight", sub: "dimensions" },
    { label: "Réservoir", key: "tank", sub: "dimensions", better: "higher" },
    { label: "Consommation", key: "consumption", better: "lower" },
  ]}
];
