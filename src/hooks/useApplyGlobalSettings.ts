import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ACCENT_CLASSES = [
  'accent-emerald', 'accent-blue', 'accent-purple', 'accent-pink',
  'accent-red', 'accent-orange', 'accent-yellow', 'accent-cyan', 'accent-custom',
];

const hexToHsl = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '158 64% 51%';
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

interface AppliedSettings {
  theme?: string;
  accentColor?: string;
  customColor?: string | null;
  customGradient?: { from: string; to: string } | null;
}

export function applySettingsToDocument(s: AppliedSettings) {
  const root = document.documentElement;
  const theme = s.theme === 'light' ? 'light' : 'dark';
  root.classList.remove('light', 'dark');
  root.classList.add(theme);

  const accent = s.accentColor || 'emerald';
  ACCENT_CLASSES.forEach(cls => root.classList.remove(cls));
  root.classList.add(`accent-${accent}`);

  if (accent !== 'custom') {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--primary-glow');
    root.style.removeProperty('--ring');
    root.style.removeProperty('--sidebar-primary');
    root.style.removeProperty('--sidebar-ring');
    return;
  }

  if (s.customGradient) {
    const fromHsl = hexToHsl(s.customGradient.from);
    const toHsl = hexToHsl(s.customGradient.to);
    root.style.setProperty('--primary', fromHsl);
    root.style.setProperty('--primary-glow', toHsl);
    root.style.setProperty('--ring', fromHsl);
    root.style.setProperty('--sidebar-primary', fromHsl);
    root.style.setProperty('--sidebar-ring', fromHsl);
  } else if (s.customColor) {
    const hsl = hexToHsl(s.customColor);
    root.style.setProperty('--primary', hsl);
    root.style.setProperty('--primary-glow', hsl);
    root.style.setProperty('--ring', hsl);
    root.style.setProperty('--sidebar-primary', hsl);
    root.style.setProperty('--sidebar-ring', hsl);
  }
}

const CACHE_KEY = 'atp_settings_cache';

function readCache(): AppliedSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(s: AppliedSettings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/**
 * Applies user settings (theme, accent, custom colors) to the document on every page,
 * including Landing and Auth. Uses localStorage cache for instant paint, then syncs
 * with the database when the user is signed in. Subscribes to realtime updates so
 * changes from another tab/device propagate everywhere.
 */
export function useApplyGlobalSettings() {
  const [userId, setUserId] = useState<string | null>(null);

  // 1) Apply cached settings immediately (no flash)
  useEffect(() => {
    const cached = readCache();
    if (cached) applySettingsToDocument(cached);
  }, []);

  // 2) Track auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 3) Fetch from DB on sign-in and subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const fetchAndApply = async () => {
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('theme, accent_color, custom_color, custom_gradient')
          .eq('user_id', userId)
          .maybeSingle();
        if (cancelled || !data) return;
        const applied: AppliedSettings = {
          theme: data.theme,
          accentColor: data.accent_color,
          customColor: data.custom_color,
          customGradient: data.custom_gradient as { from: string; to: string } | null,
        };
        applySettingsToDocument(applied);
        writeCache(applied);
      } catch (e) {
        console.warn('Global settings fetch failed', e);
      }
    };

    fetchAndApply();

    const channel = supabase
      .channel(`global-settings-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
          if (!row) return;
          const applied: AppliedSettings = {
            theme: row.theme as string,
            accentColor: row.accent_color as string,
            customColor: row.custom_color as string | null,
            customGradient: row.custom_gradient as { from: string; to: string } | null,
          };
          applySettingsToDocument(applied);
          writeCache(applied);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // 4) Sync across tabs via storage events
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CACHE_KEY && e.newValue) {
        try {
          applySettingsToDocument(JSON.parse(e.newValue));
        } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
}

export { writeCache as writeSettingsCache };
