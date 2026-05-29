import { subDays } from 'date-fns';
import { formatLocalDateKey, parseLocalDateKey } from '@/lib/tradeFormat';

export type CompareMode = 'range' | 'account' | 'tag' | 'asset' | 'dayOfWeek';

export interface CompareSlotConfig {
  start: Date;
  end: Date;
  accountId?: string | null;
  tag?: string;
  asset?: string;
  dayOfWeek?: number;
}

const dateToParam = (d: Date) => formatLocalDateKey(d);
const paramToDate = (s: string | null, fallback: Date): Date => {
  if (!s) return fallback;
  try {
    return parseLocalDateKey(s);
  } catch {
    return fallback;
  }
};

export const readCompareFromURL = (
  search: string,
): { mode: CompareMode; a: CompareSlotConfig; b: CompareSlotConfig } | null => {
  const sp = new URLSearchParams(search);
  if (sp.get('compare') !== 'true') return null;
  const mode = (sp.get('mode') as CompareMode) || 'range';
  const today = new Date();
  const a: CompareSlotConfig = {
    start: paramToDate(sp.get('aStart'), subDays(today, 14)),
    end: paramToDate(sp.get('aEnd'), subDays(today, 8)),
    accountId: sp.get('aAccount') || undefined,
    tag: sp.get('aTag') || undefined,
    asset: sp.get('aAsset') || undefined,
    dayOfWeek: sp.get('aDow') ? Number(sp.get('aDow')) : undefined,
  };
  const b: CompareSlotConfig = {
    start: paramToDate(sp.get('bStart'), subDays(today, 7)),
    end: paramToDate(sp.get('bEnd'), today),
    accountId: sp.get('bAccount') || undefined,
    tag: sp.get('bTag') || undefined,
    asset: sp.get('bAsset') || undefined,
    dayOfWeek: sp.get('bDow') ? Number(sp.get('bDow')) : undefined,
  };
  return { mode, a, b };
};

export const writeCompareToURL = (state: {
  mode: CompareMode;
  a: CompareSlotConfig;
  b: CompareSlotConfig;
}) => {
  const sp = new URLSearchParams(window.location.search);
  sp.set('compare', 'true');
  sp.set('mode', state.mode);
  sp.set('aStart', dateToParam(state.a.start));
  sp.set('aEnd', dateToParam(state.a.end));
  sp.set('bStart', dateToParam(state.b.start));
  sp.set('bEnd', dateToParam(state.b.end));
  const setOrDel = (k: string, v: string | number | null | undefined) => {
    if (v === undefined || v === null || v === '') sp.delete(k);
    else sp.set(k, String(v));
  };
  setOrDel('aAccount', state.a.accountId);
  setOrDel('bAccount', state.b.accountId);
  setOrDel('aTag', state.a.tag);
  setOrDel('bTag', state.b.tag);
  setOrDel('aAsset', state.a.asset);
  setOrDel('bAsset', state.b.asset);
  setOrDel('aDow', state.a.dayOfWeek);
  setOrDel('bDow', state.b.dayOfWeek);
  const newUrl = `${window.location.pathname}?${sp.toString()}${window.location.hash}`;
  window.history.replaceState({}, '', newUrl);
};

export const clearCompareFromURL = () => {
  const sp = new URLSearchParams(window.location.search);
  ['compare', 'mode', 'aStart', 'aEnd', 'bStart', 'bEnd', 'aAccount', 'bAccount', 'aTag', 'bTag', 'aAsset', 'bAsset', 'aDow', 'bDow'].forEach((k) =>
    sp.delete(k)
  );
  const qs = sp.toString();
  const newUrl = qs ? `${window.location.pathname}?${qs}${window.location.hash}` : `${window.location.pathname}${window.location.hash}`;
  window.history.replaceState({}, '', newUrl);
};
