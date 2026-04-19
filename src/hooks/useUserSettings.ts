import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { applySettingsToDocument, writeSettingsCache } from './useApplyGlobalSettings';

export type AccentColor = 'emerald' | 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'yellow' | 'cyan' | 'custom';

interface CustomGradient {
  from: string;
  to: string;
}

interface UserSettings {
  theme: 'dark' | 'light';
  accentColor: AccentColor;
  customColor: string;
  customGradient: CustomGradient | null;
  sidebarCollapsed: boolean;
  notebookFont: string;
}

interface DbUserSettings {
  id: string;
  user_id: string;
  theme: string;
  accent_color: string;
  custom_color: string | null;
  custom_gradient: CustomGradient | null;
  sidebar_collapsed: boolean;
  created_at: string;
  updated_at: string;
}

const defaultSettings: UserSettings = {
  theme: 'dark',
  accentColor: 'emerald',
  customColor: '#10b981',
  customGradient: null,
  sidebarCollapsed: false,
  notebookFont: 'inter',
};

export function useUserSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch settings from database
  const fetchSettings = useCallback(async () => {
    if (!userId) {
      // Load from localStorage as fallback when not logged in
      const localTheme = localStorage.getItem('atp_theme');
      const localAccent = localStorage.getItem('atp_accent_color');
      const localCustomColor = localStorage.getItem('atp_custom_color');
      const localGradient = localStorage.getItem('atp_custom_gradient');
      const localSidebar = localStorage.getItem('atp_sidebar_collapsed');

      setSettings({
        theme: (localTheme ? JSON.parse(localTheme) : 'dark') as 'dark' | 'light',
        accentColor: (localAccent ? JSON.parse(localAccent) : 'emerald') as AccentColor,
        customColor: localCustomColor ? JSON.parse(localCustomColor) : '#10b981',
        customGradient: localGradient ? JSON.parse(localGradient) : null,
        sidebarCollapsed: localSidebar ? JSON.parse(localSidebar) : false,
        notebookFont: 'inter',
      });
      setIsLoading(false);
      setIsInitialized(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          theme: data.theme as 'dark' | 'light',
          accentColor: data.accent_color as AccentColor,
          customColor: data.custom_color || '#10b981',
          customGradient: data.custom_gradient as unknown as CustomGradient | null,
          sidebarCollapsed: data.sidebar_collapsed,
          notebookFont: (data as any).notebook_font || 'inter',
        });
        
        // Clear localStorage after successful fetch from DB
        localStorage.removeItem('atp_theme');
        localStorage.removeItem('atp_accent_color');
        localStorage.removeItem('atp_custom_color');
        localStorage.removeItem('atp_custom_gradient');
        localStorage.removeItem('atp_sidebar_collapsed');
      } else {
        // No settings in DB, migrate from localStorage
        await migrateFromLocalStorage();
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [userId]);

  // Migrate localStorage settings to database
  const migrateFromLocalStorage = useCallback(async () => {
    if (!userId) return;

    const localTheme = localStorage.getItem('atp_theme');
    const localAccent = localStorage.getItem('atp_accent_color');
    const localCustomColor = localStorage.getItem('atp_custom_color');
    const localGradient = localStorage.getItem('atp_custom_gradient');
    const localSidebar = localStorage.getItem('atp_sidebar_collapsed');

    const migratedSettings: UserSettings = {
      theme: (localTheme ? JSON.parse(localTheme) : 'dark') as 'dark' | 'light',
      accentColor: (localAccent ? JSON.parse(localAccent) : 'emerald') as AccentColor,
      customColor: localCustomColor ? JSON.parse(localCustomColor) : '#10b981',
      customGradient: localGradient ? JSON.parse(localGradient) : null,
      sidebarCollapsed: localSidebar ? JSON.parse(localSidebar) : false,
      notebookFont: 'inter',
    };

    try {
      const { error } = await supabase
        .from('user_settings')
        .insert([{
          user_id: userId,
          theme: migratedSettings.theme,
          accent_color: migratedSettings.accentColor,
          custom_color: migratedSettings.customColor,
          custom_gradient: migratedSettings.customGradient ? JSON.parse(JSON.stringify(migratedSettings.customGradient)) : null,
          sidebar_collapsed: migratedSettings.sidebarCollapsed,
          notebook_font: migratedSettings.notebookFont,
        }]);

      if (error) throw error;

      setSettings(migratedSettings);
      
      // Clear localStorage after successful migration
      localStorage.removeItem('atp_theme');
      localStorage.removeItem('atp_accent_color');
      localStorage.removeItem('atp_custom_color');
      localStorage.removeItem('atp_custom_gradient');
      localStorage.removeItem('atp_sidebar_collapsed');
    } catch (error) {
      console.error('Error migrating settings:', error);
      setSettings(migratedSettings);
    }
  }, [userId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Set up realtime subscription for settings sync across devices
  useEffect(() => {
    if (!userId) return;

    // Clean up existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `settings-realtime-${userId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Settings realtime update');
          setSettings({
            theme: payload.new.theme as 'dark' | 'light',
            accentColor: payload.new.accent_color as AccentColor,
            customColor: payload.new.custom_color || '#10b981',
            customGradient: payload.new.custom_gradient as unknown as CustomGradient | null,
            sidebarCollapsed: payload.new.sidebar_collapsed,
            notebookFont: payload.new.notebook_font || 'inter',
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  // Debounced save to database
  const saveToDatabase = useCallback(async (newSettings: UserSettings) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert([{
          user_id: userId,
          theme: newSettings.theme,
          accent_color: newSettings.accentColor,
          custom_color: newSettings.customColor,
          custom_gradient: newSettings.customGradient ? JSON.parse(JSON.stringify(newSettings.customGradient)) : null,
          sidebar_collapsed: newSettings.sidebarCollapsed,
          notebook_font: newSettings.notebookFont,
        }], {
          onConflict: 'user_id',
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving user settings:', error);
    }
  }, [userId]);

  // Update a single setting with debounced save
  const updateSetting = useCallback(<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };

      // Apply visual settings immediately + cache for cross-page sync
      const visualKeys: Array<keyof UserSettings> = ['theme', 'accentColor', 'customColor', 'customGradient'];
      if (visualKeys.includes(key)) {
        const applied = {
          theme: newSettings.theme,
          accentColor: newSettings.accentColor,
          customColor: newSettings.customColor,
          customGradient: newSettings.customGradient,
        };
        applySettingsToDocument(applied);
        writeSettingsCache(applied);
      }

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Debounce save to database
      saveTimeoutRef.current = setTimeout(() => {
        saveToDatabase(newSettings);
      }, 500);
      
      return newSettings;
    });
  }, [saveToDatabase]);

  // Cleanup timeout on unmount
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
    isInitialized,
    updateSetting,
    setTheme: (theme: 'dark' | 'light') => updateSetting('theme', theme),
    setAccentColor: (color: AccentColor) => updateSetting('accentColor', color),
    setCustomColor: (color: string) => updateSetting('customColor', color),
    setCustomGradient: (gradient: CustomGradient | null) => updateSetting('customGradient', gradient),
    setSidebarCollapsed: (collapsed: boolean) => updateSetting('sidebarCollapsed', collapsed),
    setNotebookFont: (font: string) => updateSetting('notebookFont', font),
  };
}