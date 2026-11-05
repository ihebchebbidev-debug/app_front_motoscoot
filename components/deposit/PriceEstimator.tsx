import React from 'react';
import { CircleDollarSign, BarChart3 } from 'lucide-react';

interface PriceEstimatorProps {
  estimation: number | null;
  hasEnoughData: boolean;
}

export const PriceEstimator: React.FC<PriceEstimatorProps> = ({ estimation, hasEnoughData }) => {
  if (!hasEnoughData) {
    return (
      <div className="flex items-center gap-3 py-3 px-6 bg-gray-50/50 rounded-2xl border border-gray-100/50 shrink-0">
        <BarChart3 size={20} className="text-gray-400 shrink-0" aria-hidden="true" />
        <span className="text-[12px] font-semibold text-gray-500 leading-snug">
          Pas encore assez d'annonces similaires pour estimer le prix du marché.
        </span>
      </div>
    );
  }

  if (estimation === null) return null;

  return (
    <div className="flex items-center gap-4 py-3 px-6 bg-gray-50/50 rounded-2xl border border-gray-100/50 group transition-all hover:border-primary-100 shrink-0">
      <div className="w-9 h-9 rounded-xl bg-card flex items-center justify-center text-primary-700 border border-gray-100 shadow-none">
        <CircleDollarSign size={20} />
      </div>
      <div>
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="text-lg font-black text-gray-900">{estimation.toLocaleString()}</span>
          <span className="text-[12px] font-black text-gray-500 uppercase">DT</span>
        </div>
        <p className="text-[12px] font-semibold text-gray-500 mt-1">Prix du marché (moyenne)</p>
      </div>
    </div>
  );
};