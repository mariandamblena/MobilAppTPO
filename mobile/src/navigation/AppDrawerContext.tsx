import { createContext, useContext } from 'react';

/**
 * Contexto del drawer global. El estado vive en `app/(tabs)/_layout.tsx`;
 * el `AppBar` (hamburguesa) lo dispara vía `useAppDrawer().openDrawer()`.
 */
export interface AppDrawerValue {
  openDrawer: () => void;
}

export const AppDrawerContext = createContext<AppDrawerValue>({ openDrawer: () => {} });

export function useAppDrawer(): AppDrawerValue {
  return useContext(AppDrawerContext);
}
