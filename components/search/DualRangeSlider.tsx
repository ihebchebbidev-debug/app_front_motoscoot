
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

interface DualRangeSliderProps {
  label: string;
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  step?: number;
  unit?: string;
  onChange: (min: number, max: number) => void;
  debounceMs?: number;
}

/**
 * DualRangeSlider - Version Optimisée iPad Pro 120Hz.
 * Découple le rendu visuel (barre orange) de l'état React pour une fluidité maximale.
 */
export const DualRangeSlider: React.FC<DualRangeSliderProps> = ({ 
  label, 
  min, 
  max, 
  valueMin, 
  valueMax, 
  step = 1, 
  unit = '', 
  onChange,
  debounceMs = 250
}) => {
  const [minVal, setMinVal] = useState(valueMin);
  const [maxVal, setMaxVal] = useState(valueMax);
  
  const rangeRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevValuesRef = useRef({ min: valueMin, max: valueMax });
  
  // Synchronisation externe (ex: bouton Reset)
  useEffect(() => {
    if (prevValuesRef.current.min !== valueMin || prevValuesRef.current.max !== valueMax) {
      setMinVal(valueMin);
      setMaxVal(valueMax);
      prevValuesRef.current = { min: valueMin, max: valueMax };
    }
  }, [valueMin, valueMax]);

  // Calcul des styles visuels
  const { minPercent, rangeWidth, minZIndex } = useMemo(() => {
    const range = max - min;
    const minP = ((Math.max(min, Math.min(minVal, max)) - min) / range) * 100;
    const maxP = ((Math.max(min, Math.min(maxVal, max)) - min) / range) * 100;
    return {
      minPercent: minP,
      rangeWidth: Math.max(0, maxP - minP),
      minZIndex: minVal > min + range / 2 ? 50 : 20
    };
  }, [minVal, maxVal, min, max]);

  // Mise à jour visuelle haute performance (hors cycle React standard)
  useEffect(() => {
    let rafId: number;
    const updateStyle = () => {
      if (rangeRef.current) {
        rangeRef.current.style.left = `${minPercent}%`;
        rangeRef.current.style.width = `${rangeWidth}%`;
      }
    };
    rafId = requestAnimationFrame(updateStyle);
    return () => cancelAnimationFrame(rafId);
  }, [minPercent, rangeWidth]);

  // Émission des changements (Debounced)
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const vMin = Math.max(min, Math.min(minVal, maxVal - step));
      const vMax = Math.min(max, Math.max(maxVal, minVal + step));
      if (prevValuesRef.current.min !== vMin || prevValuesRef.current.max !== vMax) {
        onChange(vMin, vMax);
        prevValuesRef.current = { min: vMin, max: vMax };
      }
    }, debounceMs);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [minVal, maxVal, debounceMs, min, max, step, onChange]);

  const sliderClasses = "absolute pointer-events-none appearance-none h-2 w-full bg-transparent [contain:layout_style] [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-600 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:will-change-transform active:[&::-webkit-slider-thumb]:scale-110 transition-transform duration-200";

  // Classes pour cacher les flèches (spinners) sur Chrome, Safari et Firefox
  const hideSpinnersClasses = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div className="mb-8 [contain:layout]">
      <label className="block text-[15px] font-bold text-gray-900 mb-4 tracking-tight">{label}</label>

      <div className="relative w-full h-10 flex items-center mb-5 touch-none [contain:layout_style_paint]">
        <input 
          type="range" min={min} max={max} step={step} value={minVal} 
          onChange={e => setMinVal(Math.min(Number(e.target.value), maxVal - step))} 
          className={sliderClasses} style={{ zIndex: minZIndex }} 
          aria-label={`Minimum ${label}`}
        />
        <input 
          type="range" min={min} max={max} step={step} value={maxVal} 
          onChange={e => setMaxVal(Math.max(Number(e.target.value), minVal + step))} 
          className={`${sliderClasses} z-30`} 
          aria-label={`Maximum ${label}`}
        />
        <div className="relative w-full h-2 bg-gray-200 rounded-full z-10 pointer-events-none">
          <div 
            ref={rangeRef}
            className="absolute z-10 h-2 bg-primary-600 rounded-full" 
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="relative group">
          <input 
            type="number" 
            value={minVal} 
            onChange={e => setMinVal(e.target.value === '' ? min : Number(e.target.value))} 
            className={`w-full pl-2 pr-7 py-3 bg-muted border border-gray-200 rounded-xl text-[13px] font-bold text-gray-900 text-center outline-none focus:bg-card focus:border-primary-600 transition-all ${hideSpinnersClasses}`} 
          />
          {unit && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-bold uppercase tracking-wide pointer-events-none">{unit}</span>}
        </div>
        <div className="relative group">
          <input 
            type="number" 
            value={maxVal} 
            onChange={e => setMaxVal(e.target.value === '' ? max : Number(e.target.value))} 
            className={`w-full pl-2 pr-7 py-3 bg-muted border border-gray-200 rounded-xl text-[13px] font-bold text-gray-900 text-center outline-none focus:bg-card focus:border-primary-600 transition-all ${hideSpinnersClasses}`} 
          />
          {unit && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-bold uppercase tracking-wide pointer-events-none">{unit}</span>}
        </div>
      </div>
    </div>
  );
};
