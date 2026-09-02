import { useSyncExternalStore } from 'react';
import { getDocumentTheme, subscribeToTheme, type AppTheme } from '@/lib/theme';

export function useDocumentTheme(): AppTheme {
  return useSyncExternalStore(subscribeToTheme, getDocumentTheme, () => 'dark');
}
