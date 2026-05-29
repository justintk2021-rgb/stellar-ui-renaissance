import { useEffect, useCallback, useRef } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { applySettingsToDocument, writeSettingsCache } from './useApplyGlobalSettings';

import { loadGoogleFont } from '@/lib/fonts';

import { queryKeys } from '@/lib/queries/keys';

import {

  defaultUserSettings,

  fetchUserSettings,

  saveUserSettings,

  subscribeUserSettingsRealtime,

  type AccentColor,

  type CustomGradient,

  type UserSettings,

} from '@/lib/queries/settings';



export type { AccentColor };



export function useUserSettings(userId: string | undefined) {

  const queryClient = useQueryClient();

  const queryKey = queryKeys.settings.user(userId ?? '');

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  const { data: settings = defaultUserSettings, isLoading, isFetched } = useQuery({

    queryKey,

    queryFn: () => fetchUserSettings(userId),

    staleTime: 60_000,

  });



  useEffect(() => {

    if (!userId) return;

    return subscribeUserSettingsRealtime(userId, (nextSettings) => {

      queryClient.setQueryData(queryKey, nextSettings);

    });

  }, [userId, queryClient, queryKey]);



  const setSettings = useCallback((updater: UserSettings | ((prev: UserSettings) => UserSettings)) => {

    queryClient.setQueryData<UserSettings>(queryKey, (prev) => {

      const base = prev ?? defaultUserSettings;

      return typeof updater === 'function' ? updater(base) : updater;

    });

  }, [queryClient, queryKey]);



  const saveToDatabase = useCallback(async (newSettings: UserSettings) => {

    if (!userId) return;

    try {

      await saveUserSettings(userId, newSettings);

    } catch (error) {

      console.error('Error saving user settings:', error);

    }

  }, [userId]);



  const persistVisualSettings = useCallback((newSettings: UserSettings) => {

    const applied = {

      theme: newSettings.theme,

      accentColor: newSettings.accentColor,

      customColor: newSettings.customColor,

      customGradient: newSettings.customGradient,

    };

    applySettingsToDocument(applied);

    writeSettingsCache(applied);



    if (saveTimeoutRef.current) {

      clearTimeout(saveTimeoutRef.current);

    }

    saveTimeoutRef.current = setTimeout(() => {

      saveToDatabase(newSettings);

    }, 500);

  }, [saveToDatabase]);



  const updateSetting = useCallback(<K extends keyof UserSettings>(

    key: K,

    value: UserSettings[K]

  ) => {

    setSettings(prev => {

      const newSettings = { ...prev, [key]: value };



      const visualKeys: Array<keyof UserSettings> = ['theme', 'accentColor', 'customColor', 'customGradient'];

      if (visualKeys.includes(key)) {

        if (key !== 'theme') {

          const applied = {

            theme: newSettings.theme,

            accentColor: newSettings.accentColor,

            customColor: newSettings.customColor,

            customGradient: newSettings.customGradient,

          };

          applySettingsToDocument(applied);

          writeSettingsCache(applied);

        } else {

          writeSettingsCache({

            theme: newSettings.theme,

            accentColor: newSettings.accentColor,

            customColor: newSettings.customColor,

            customGradient: newSettings.customGradient,

          });

        }



        if (saveTimeoutRef.current) {

          clearTimeout(saveTimeoutRef.current);

        }

        saveTimeoutRef.current = setTimeout(() => {

          saveToDatabase(newSettings);

        }, 500);

      } else if (key === 'sidebarCollapsed' || key === 'notebookFont') {

        if (saveTimeoutRef.current) {

          clearTimeout(saveTimeoutRef.current);

        }

        saveTimeoutRef.current = setTimeout(() => {

          saveToDatabase(newSettings);

        }, 500);

      }



      return newSettings;

    });

  }, [saveToDatabase, setSettings]);



  const setCustomAccent = useCallback((color: string) => {

    setSettings(prev => {

      const newSettings: UserSettings = {

        ...prev,

        accentColor: 'custom',

        customColor: color,

        customGradient: null,

      };

      persistVisualSettings(newSettings);

      return newSettings;

    });

  }, [persistVisualSettings, setSettings]);



  useEffect(() => {

    return () => {

      if (saveTimeoutRef.current) {

        clearTimeout(saveTimeoutRef.current);

      }

    };

  }, []);



  return {

    settings,

    isLoading,

    isInitialized: isFetched,

    updateSetting,

    setTheme: (theme: 'dark' | 'light') => updateSetting('theme', theme),

    setAccentColor: (color: AccentColor) => updateSetting('accentColor', color),

    setCustomColor: (color: string) => updateSetting('customColor', color),

    setCustomAccent,

    setCustomGradient: (gradient: CustomGradient | null) => updateSetting('customGradient', gradient),

    setSidebarCollapsed: (collapsed: boolean) => updateSetting('sidebarCollapsed', collapsed),

    setNotebookFont: (font: string) => {

      loadGoogleFont(font);

      updateSetting('notebookFont', font);

    },

  };

}

