import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

export type MonitorToastData = {
  accion: 'entrada' | 'salida';
  producto_nombre: string;
  producto_emoji: string;
  cantidad_restante: number | null;
};

type MonitorContextType = {
  showMonitorToast: (data: MonitorToastData) => void;
  toast: MonitorToastData | null;
  visible: boolean;
  hide: () => void;
};

const MonitorContext = createContext<MonitorContextType>({
  showMonitorToast: () => {},
  toast: null,
  visible: false,
  hide: () => {},
});

export function MonitorProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<MonitorToastData | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const showMonitorToast = useCallback((data: MonitorToastData) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(data);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 4000);
  }, []);

  return (
    <MonitorContext.Provider value={{ showMonitorToast, toast, visible, hide }}>
      {children}
    </MonitorContext.Provider>
  );
}

export function useMonitor() {
  return useContext(MonitorContext);
}
