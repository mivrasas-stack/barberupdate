import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (!toasts.length) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map(toast => {
        let Icon = Info;
        let borderClass = 'border-blue-500/30 text-blue-400';
        if (toast.type === 'success') {
          Icon = CheckCircle2;
          borderClass = 'border-emerald-500/40 text-emerald-400';
        } else if (toast.type === 'error') {
          Icon = AlertCircle;
          borderClass = 'border-red-500/40 text-red-400';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-[#161616]/95 backdrop-blur-md border ${borderClass} shadow-xl text-xs text-white transition-all`}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 text-neutral-200">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-neutral-400 hover:text-white shrink-0 ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
