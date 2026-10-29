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
        <BarChart3 size={20} className="text-gray-300" />
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight leading-tight">
          Pas assez de données<br/>pour estimation
        </span>
      </div>
    );
  }

  if (estimation === null) return null;

  return (
    <div className="flex items-center gap-4 py-3 px-6 bg-gray-50/50 rounded-2xl border border-gray-100/50 group transition-all hover:border-primary-100 shrink-0">
      <div className="w-9 h-9 rounded-xl bg-card flex items-center justify-center text-primary-500 border border-gray-100 shadow-none">
        <CircleDollarSign size={20} />
      </div>
      <div>
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="text-lg font-black text-gray-900">{estimation.toLocaleString()}</span>
          <span className="text-[12px] font-black text-gray-400 uppercase">DT</span>
        </div>
        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Prix du Marché</p>
      </div>
    </div>
  );
};