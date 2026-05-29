import { supabase } from '@/integrations/supabase/client';
import { loadGoogleFont } from '@/lib/fonts';
import { acquireSharedPostgresChannel } from '@/lib/queries/realtimeChannel';

export type AccentColor = 'emerald' | 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'yellow' | 'cyan' | 'custom';

export interface CustomGradient {
  from: string;
  to: string;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  accentColor: AccentColor;
  customColor: string;
  customGradient: CustomGradient | null;
  sidebarCollapsed: boolean;
  notebookFont: string;
}

export const defaultUserSettings: UserSettings = {
  theme: 'dark',
  accentColor: 'emerald',
  customColor: '#10b981',
  customGradient: null,
  sidebarCollapsed: true,
  notebookFont: 'inter',
};

function readLocalSettings(): UserSettings {
  const localTheme = localStorage.getItem('atp_theme');
  const localAccent = localStorage.getItem('atp_accent_color');
  const localCustomColor = localStorage.getItem('atp_custom_color');
  const localGradient = localStorage.getItem('atp_custom_gradient');
  const localSidebar = localStorage.getItem('atp_sidebar_collapsed');

  return {
    theme: (localTheme ? JSON.parse(localTheme) : 'dark') as 'dark' | 'light',
    accentColor: (localAccent ? JSON.parse(localAccent) : 'emerald') as AccentColor,
    customColor: localCustomColor ? JSON.parse(localCustomColor) : '#10b981',
    customGradient: localGradient ? JSON.parse(localGradient) : null,
    sidebarCollapsed: localSidebar ? JSON.parse(localSidebar) : true,
    notebookFont: 'inter',
  };
}

function clearLocalSettingsCache() {
  localStorage.removeItem('atp_theme');
  localStorage.removeItem('atp_accent_color');
  localStorage.removeItem('atp_custom_color');
  localStorage.removeItem('atp_custom_gradient');
  localStorage.removeItem('atp_sidebar_collapsed');
}

function mapDbRow(data: Record<string, unknown>): UserSettings {
  return {
    theme: data.theme as 'dark' | 'light',
    accentColor: data.accent_color as AccentColor,
    customColor: (data.custom_color as string) || '#10b981',
    customGradient: data.custom_gradient as unknown as CustomGradient | null,
    sidebarCollapsed: data.sidebar_collapsed as boolean,
    notebookFont: (data.notebook_font as string) || 'inter',
  };
}

async function migrateFromLocalStorage(userId: string): Promise<UserSettings> {
  const migratedSettings = readLocalSettings();

  const { error } = await supabase.from('user_settings').insert([{
    user_id: userId,
    theme: migratedSettings.theme,
    accent_color: migratedSettings.accentColor,
    custom_color: migratedSettings.customColor,
    custom_gradient: migratedSettings.customGradient ? JSON.parse(JSON.stringify(migratedSettings.customGradient)) : null,
    sidebar_collapsed: migratedSettings.sidebarCollapsed,
    notebook_font: migratedSettings.notebookFont,
  }]);

  if (error) throw error;

  clearLocalSettingsCache();
  return migratedSettings;
}

export async function fetchUserSettings(userId: string | undefined): Promise<UserSettings> {
  if (!userId) return readLocalSettings();

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    const settings = mapDbRow(data as Record<string, unknown>);
    loadGoogleFont(settings.notebookFont);
    clearLocalSettingsCache();
    return settings;
  }

  try {
    return await migrateFromLocalStorage(userId);
  } catch {
    return readLocalSettings();
  }
}

export async function saveUserSettings(userId: string, settings: UserSettings): Promise<void> {
  const { error } = await supabase.from('user_settings').upsert([{
    user_id: userId,
    theme: settings.theme,
    accent_color: settings.accentColor,
    custom_color: settings.customColor,
    custom_gradient: settings.customGradient ? JSON.parse(JSON.stringify(settings.customGradient)) : null,
    sidebar_collapsed: settings.sidebarCollapsed,
    notebook_font: settings.notebookFont,
  }], { onConflict: 'user_id' });

  if (error) throw error;
}

export function subscribeUserSettingsRealtime(userId: string, onUpdate: (settings: UserSettings) => void) {
  return acquireSharedPostgresChannel(
    `settings-realtime-${userId}`,
    [{
      event: 'UPDATE',
      schema: 'public',
      table: 'user_settings',
      filter: `user_id=eq.${userId}`,
    }],
    async () => {
      const settings = await fetchUserSettings(userId);
      onUpdate(settings);
    },
  );
}
