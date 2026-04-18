import { createContext, type PropsWithChildren, useContext } from 'react';

import { useActivityMonitor } from '@/src/modules/activity-recognition/hooks/use-activity-monitor';

type ActivityMonitorStore = ReturnType<typeof useActivityMonitor>;

const ActivityMonitorContext = createContext<ActivityMonitorStore | null>(null);

export function ActivityMonitorProvider({ children }: Readonly<PropsWithChildren>) {
  const store = useActivityMonitor();

  return <ActivityMonitorContext.Provider value={store}>{children}</ActivityMonitorContext.Provider>;
}

export function useActivityMonitorContext(): ActivityMonitorStore {
  const context = useContext(ActivityMonitorContext);

  if (!context) {
    throw new Error('useActivityMonitorContext must be used within ActivityMonitorProvider');
  }

  return context;
}
