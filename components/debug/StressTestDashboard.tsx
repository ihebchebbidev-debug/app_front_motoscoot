
import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, Cpu, Database, Zap, Bomb, AlertCircle } from 'lucide-react';
import { Badge } from '../ui/Badge';

export const StressTestDashboard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fps, setFps] = useState(60);
  const [memory, setMemory] = useState(0);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();

    const updateMetrics = () => {
      frameCount++;
      const now = performance.now();
      if (now >= lastTime + 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
        // @ts-ignore
        if (performance.memory) setMemory(Math.round(performance.memory.usedJSHeapSize / 1048576));
      }
      requestAnimationFrame(updateMetrics);
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') setIsOpen((prev) => !prev);
    };

    const rafId = requestAnimationFrame(updateMetrics);
    window.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[999] w-96 bg-gray-900 border border-red-900/50 rounded-[2.5rem] p-8 shadow-2xl animate-fade-in-up text-white font-sans">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-600 rounded-xl animate-pulse">
            <Bomb size={20} />
          </div>
          <div>
            <h3 className="font-black text-xl italic tracking-tighter uppercase">Omega v5.0</h3>
            <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Diagnostic Stress Test</span>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">×</button>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/40 p-4 rounded-2xl border border-gray-800">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Cpu size={14} /> <span className="text-[12px] font-black uppercase">FPS</span>
            </div>
            <div className={`text-2xl font-black ${fps < 30 ? 'text-red-500' : 'text-success-500'}`}>{fps}</div>
          </div>
          <div className="bg-black/40 p-4 rounded-2xl border border-gray-800">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Database size={14} /> <span className="text-[12px] font-black uppercase">Heap</span>
            </div>
            <div className="text-2xl font-black text-blue-500">{memory} MB</div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-[12px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Activity size={14} /> Résultats du Rapport
          </h4>
          <div className="bg-red-950/20 p-4 rounded-2xl border border-red-900/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-red-400">Robustesse Globale</span>
              <span className="text-xs font-black text-red-500">68%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-600 w-[68%]" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <AlertCircle size={16} className="text-warning-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-gray-400 leading-relaxed">
              <strong className="text-white">VULNÉRABILITÉ</strong>: Le filtrage de 10k éléments cause un blocage du thread principal sans <code className="text-primary-400">useTransition</code>.
            </p>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <Zap size={16} className="text-primary-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-gray-400 leading-relaxed">
              <strong className="text-white">OPTIMISATION</strong>: ErrorBoundaries activées pour isoler les sections critiques.
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-8 pt-4 border-t border-gray-800 text-center">
        <span className="text-[8px] font-black text-gray-600 uppercase tracking-[0.3em]">Status: Diagnostic en cours</span>
      </div>
    </div>
  );
};
