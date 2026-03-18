import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
  removing?: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 0;

const config: Record<ToastType, { icon: React.ElementType; bg: string; accent: string }> = {
  success: { icon: CheckCircle, bg: 'bg-green-50 border-green-400', accent: 'text-green-600' },
  error:   { icon: XCircle,     bg: 'bg-red-50 border-red-400',     accent: 'text-red-600' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 border-amber-400', accent: 'text-amber-600' },
  info:    { icon: Info,         bg: 'bg-blue-50 border-blue-400',   accent: 'text-blue-600' },
};

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const { icon: Icon, bg, accent } = config[t.type];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => onRemove(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, onRemove]);

  return (
    <div
      onClick={() => onRemove(t.id)}
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg cursor-pointer
        transition-all duration-300 ease-out max-w-sm w-full ${bg}
        ${visible && !t.removing ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
    >
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${accent}`} />
      <p className="text-sm text-gray-800 flex-1 leading-snug">{t.message}</p>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(t.id); }}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, removing: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    setToasts((prev) => [...prev, { id: nextId++, message, type, duration }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
