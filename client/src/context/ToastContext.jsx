import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  };

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full">
        {toasts.map((t) => {
          let bg = 'bg-slate-800 text-white border-slate-700';
          let icon = 'ℹ️';

          if (t.type === 'success') {
            bg = 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50 shadow-emerald-900/30';
            icon = '✅';
          } else if (t.type === 'error') {
            bg = 'bg-rose-950/90 text-rose-200 border-rose-500/50 shadow-rose-900/30';
            icon = '⚠️';
          } else if (t.type === 'warning') {
            bg = 'bg-amber-950/90 text-amber-200 border-amber-500/50 shadow-amber-900/30';
            icon = '⚡';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start space-x-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-slide-in ${bg}`}
            >
              <span className="text-lg flex-shrink-0">{icon}</span>
              <div className="flex-1 text-sm font-medium leading-snug">{t.message}</div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-xs opacity-60 hover:opacity-100 flex-shrink-0 ml-1 p-0.5"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Return a safe console fallback if invoked outside provider
    return {
      toast: {
        success: (m) => console.log('Toast [success]:', m),
        error: (m) => console.error('Toast [error]:', m),
        info: (m) => console.log('Toast [info]:', m),
        warning: (m) => console.warn('Toast [warning]:', m),
      },
    };
  }
  return context;
};

export default ToastContext;
