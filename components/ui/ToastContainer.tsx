import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToast, Toast, ToastType } from '../../context/ToastContext';

const ICON_MAP: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const STYLE_MAP: Record<ToastType, string> = {
  success: 'bg-emerald-600/95 border-emerald-500 text-white',
  error: 'bg-red-600/95 border-red-500 text-white',
  info: 'bg-gray-900/95 border-gray-800 text-white',
  warning: 'bg-amber-600/95 border-amber-500 text-white',
};

const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const { removeToast } = useToast();
  const Icon = ICON_MAP[toast.type];

  return (
    <div 
      className={`
        flex items-center gap-4 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl
        animate-fade-in-up transition-all duration-300 pointer-events-auto mb-3
        ${STYLE_MAP[toast.type]}
      `}
      role="alert"
    >
      <div className="p-2 bg-white/10 rounded-xl shrink-0">
        <Icon size={20} strokeWidth={2.5} />
      </div>
      <div className="flex flex-col min-w-0 pr-2">
        <span className="text-[9px] font-black uppercase opacity-60 leading-none mb-1 tracking-widest">
          {toast.type === 'info' ? 'Notification' : 'Système'}
        </span>
        <span className="text-sm font-bold leading-tight">{toast.message}</span>
      </div>
      <button 
        onClick={() => removeToast(toast.id)}
        className="p-1.5 hover:bg-white/10 rounded-full transition-colors shrink-0 ml-auto"
        aria-label="Fermer"
      >
        <X size={16} strokeWidth={3} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  return (
    <div 
      className="fixed bottom-32 md:bottom-10 right-3 md:right-10 left-3 md:left-auto z-[2000] flex flex-col items-stretch md:items-end pointer-events-none w-auto md:w-full md:max-w-sm"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};