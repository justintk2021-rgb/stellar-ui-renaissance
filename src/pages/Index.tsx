import { useState, useEffect, useCallback, useRef, lazy, Suspense, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trade, NotebookEntry } from "@/types/trade";
import { useThemeChange } from "@/hooks/useThemeTransition";
import { useTrades } from "@/hooks/useTrades";
import { useTradingAccounts } from "@/hooks/useTradingAccounts";
import { useNotebookEntries } from "@/hooks/useNotebookEntries";
import { useUserSettings, AccentColor } from "@/hooks/useUserSettings";
import { useChecklists } from "@/hooks/useChecklists";
import { Sidebar } from "@/components/Layout/Sidebar";
import { MobileNav } from "@/components/Layout/MobileNav";
import { TopBar } from "@/components/Layout/TopBar";
import { BalanceCards } from "@/components/Dashboard/BalanceCards";
import { useAccountProjection } from "@/hooks/useAccountProjection";
import { DashboardStatsLayout } from "@/components/Dashboard/DashboardStatsLayout";
import { TradeFormModal } from "@/components/Journal/TradeFormModal";
import { MiniCalendar } from "@/components/Journal/MiniCalendar";
import { readCompareFromURL, clearCompareFromURL } from "@/lib/compareUrl";
import { YearMonthPicker, type MonthSelection } from "@/components/Journal/YearMonthPicker";
import { AccountSelector } from "@/components/Dashboard/AccountSelector";
import {
  buildDailyPnLMap,
  getClientDayBoundsISO,
  getTradeCloseLocalDateKey,
} from "@/lib/tradeFormat";
import { queryKeys } from "@/lib/queries/keys";
import { fetchTradesList } from "@/lib/queries/trades";
import { useBrokerTodayPnL } from "@/hooks/useBrokerTodayPnL";
import { repairTradeLockerSessions } from "@/lib/repairBrokerSession";

const TradeTable = lazy(() => import("@/components/Journal/TradeTable").then(m => ({ default: m.TradeTable })));
const CompareView = lazy(() => import("@/components/Journal/CompareView").then(m => ({ default: m.CompareView })));

// Lazy-load heavy/secondary pages so the dashboard paints instantly.
const NotebookView = lazy(() => import("@/components/Notebook/NotebookView").then(m => ({ default: m.NotebookView })));
const SettingsView = lazy(() => import("@/components/Settings/SettingsView").then(m => ({ default: m.SettingsView })));
const CustomChart = lazy(() => import("@/components/Chart/CustomChart").then(m => ({ default: m.CustomChart })));
const PlaybookView = lazy(() => import("@/components/Playbook/PlaybookView").then(m => ({ default: m.PlaybookView })));
const EconomicCalendarView = lazy(() => import("@/components/EconomicCalendar/EconomicCalendarView").then(m => ({ default: m.EconomicCalendarView })));
const CommunityView = lazy(() => import("@/components/Community/CommunityView").then(m => ({ default: m.CommunityView })));

// 3D animated background is ~600KB (three.js + drei). Lazy-load and only mount on the dashboard tab.
const AnimatedBackground = lazy(() => import("@/components/Layout/AnimatedBackground").then(m => ({ default: m.AnimatedBackground })));

import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageTransition, staggerItem } from "@/components/Layout/PageTransition";
import { LoadingScreen } from "@/components/Layout/LoadingScreen";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw } from "lucide-react";

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <RefreshCw className="h-5 w-5 text-muted-foreground/60 animate-spin" />
  </div>
);

const pageInfo: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your trading performance' },
  journal: { title: 'Journal', subtitle: 'Log and manage your trades' },
  chart: { title: 'Chart', subtitle: 'Interactive chart with drawing tools' },
  calendar: { title: 'Economic Calendar', subtitle: 'Live economic news and events' },
  playbook: { title: 'Playbook', subtitle: 'Your trading checklists and rules' },
  notebook: { title: 'Notebook', subtitle: 'Your personal trading notes and journal' },
  community: { title: 'Community', subtitle: 'Chat with other traders' },
  settings: { title: 'Settings', subtitle: 'Customize your preferences' },
};

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

/** Dev-only: capture real UI for marketing screenshots (?preview=marketing). */
const isMarketingPreview =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "marketing";

const PREVIEW_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "preview@local.dev",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as User;

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(isMarketingPreview);
  const [authReady, setAuthReady] = useState(isMarketingPreview);
  // Post-login boot screen: stays up until the initial data has loaded so the
  // dashboard appears fully populated instead of popping in piece by piece.
  const [bootComplete, setBootComplete] = useState(isMarketingPreview);
  const bootStartRef = useRef<number>(Date.now());
  const [currentPage, setCurrentPage] = useState(() => {
    if (isMarketingPreview) {
      const page = new URLSearchParams(window.location.search).get("page");
      if (page) return page;
    }
    return "dashboard";
  });
  const [selectedBrokerAccountId, setSelectedBrokerAccountId] = useState<string | null>(() => {
    return localStorage.getItem('selectedBrokerAccountId') || null;
  });
  const [brokerBalance, setBrokerBalance] = useState<number | null>(null);
  const [brokerEquity, setBrokerEquity] = useState<number | null>(null);
  const [brokerFloatingPl, setBrokerFloatingPl] = useState<number>(0);
  const [brokerHasOpenPositions, setBrokerHasOpenPositions] = useState<boolean>(false);
  const [brokerSyncing, setBrokerSyncing] = useState(false);
  const queryClient = useQueryClient();
  const { brokerDayTotals, connectionId: brokerConnectionId } = useBrokerTodayPnL(
    user?.id,
    selectedBrokerAccountId,
  );

  // Persist broker account selection
  const handleSetBrokerAccountId = useCallback((id: string | null) => {
    setSelectedBrokerAccountId(id);
    if (id) {
      localStorage.setItem('selectedBrokerAccountId', id);
    } else {
      localStorage.removeItem('selectedBrokerAccountId');
    }
  }, []);

  // Use trading accounts
  const {
    accounts,
    selectedAccount,
    selectedAccountId,
    setSelectedAccountId,
    isLoading: accountsLoading,
    addAccount,
    updateAccount,
    deleteAccount,
    setDefaultAccount,
  } = useTradingAccounts(user?.id);
  
  // Use database-backed trades filtered by selected account or broker account
  const { 
    trades, 
    isLoading: tradesLoading, 
    addTrade, 
    updateTrade, 
    deleteTrade, 
    clearAllTrades, 
    importTrades 
  } = useTrades(user?.id, selectedBrokerAccountId ? null : selectedAccountId, selectedBrokerAccountId);

  // Dismiss the boot screen once auth + initial data are ready (min 1.2s so
  // the transition feels intentional, max 8s failsafe so it can never hang).
  useEffect(() => {
    if (bootComplete || !authReady || !session) return;
    if (tradesLoading || accountsLoading) return;
    const MIN_BOOT_MS = 1200;
    const elapsed = Date.now() - bootStartRef.current;
    const t = setTimeout(() => setBootComplete(true), Math.max(0, MIN_BOOT_MS - elapsed));
    return () => clearTimeout(t);
  }, [bootComplete, authReady, session, tradesLoading, accountsLoading]);

  useEffect(() => {
    if (bootComplete) return;
    const t = setTimeout(() => setBootComplete(true), 8000);
    return () => clearTimeout(t);
  }, [bootComplete]);

  // Auto-sync with broker - throttled to once per 60s, runs in background
  const lastSyncRef = useRef<number>(0);
  const inFlightSyncRef = useRef<boolean>(false);
  const brokerAutoSync = useCallback(async (force = false) => {
    if (!user?.id) return;
    const now = Date.now();
    if (!force && (inFlightSyncRef.current || now - lastSyncRef.current < 60_000)) return;
    inFlightSyncRef.current = true;
    lastSyncRef.current = now;
    try {
      const { data: connections } = await supabase
        .from('broker_connections')
        .select('id, connection_status')
        .eq('user_id', user.id)
        .eq('platform', 'tradelocker')
        .in('connection_status', ['connected', 'expired']);

      if (!connections?.length) return;

      setBrokerSyncing(true);
      // Use raw fetch to bypass the SDK's throw-on-non-2xx behavior, which
      // otherwise surfaces as an uncaught runtime error in the dev overlay.
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
      const anonKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const dayBounds = getClientDayBoundsISO();
      const invokeBroker = (payload: Record<string, unknown>) =>
        fetch(`${supabaseUrl}/functions/v1/tradelocker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
            Authorization: `Bearer ${token ?? anonKey}`,
          },
          body: JSON.stringify(payload),
        });

      await Promise.allSettled(
        connections.map(async (conn) => {
          try {
            if (conn.connection_status === 'expired') {
              const refreshRes = await invokeBroker({ action: 'refresh-session', connectionId: conn.id });
              try { await refreshRes.text(); } catch {}
              if (!refreshRes.ok) return;
            }

            let res = await invokeBroker({
              action: 'sync',
              connectionId: conn.id,
              clientToday: dayBounds.dateKey,
              clientDayStart: dayBounds.start,
              clientDayEnd: dayBounds.end,
            });

            if (res.status === 401) {
              const refreshRes = await invokeBroker({ action: 'refresh-session', connectionId: conn.id });
              try { await refreshRes.text(); } catch {}
              if (refreshRes.ok) {
                res = await invokeBroker({
                  action: 'sync',
                  connectionId: conn.id,
                  clientToday: dayBounds.dateKey,
                  clientDayStart: dayBounds.start,
                  clientDayEnd: dayBounds.end,
                });
              } else {
                await supabase
                  .from('broker_connections')
                  .update({ connection_status: 'expired', last_error: 'Session expired — reconnect in Settings' })
                  .eq('id', conn.id);
              }
            }
            try { await res.text(); } catch {}
          } catch {
            // Network errors silently ignored — surfaced via Broker Management UI.
          }
        })
      );
      window.dispatchEvent(new CustomEvent('broker-sync-complete'));
      queryClient.invalidateQueries({ queryKey: queryKeys.trades.all });
      for (const conn of connections) {
        queryClient.invalidateQueries({ queryKey: queryKeys.broker.positions(conn.id) });
      }
    } catch (e) {
      console.warn('Auto broker sync check failed:', e);
    } finally {
      setBrokerSyncing(false);
      inFlightSyncRef.current = false;
    }
  }, [user?.id, queryClient]);

  // On login: silently refresh expired TradeLocker tokens, then sync
  useEffect(() => {
    if (!user?.id || isMarketingPreview) return;
    let cancelled = false;
    (async () => {
      const { restored } = await repairTradeLockerSessions();
      if (cancelled) return;
      if (restored > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.trades.all });
      }
      brokerAutoSync(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, brokerAutoSync, queryClient]);

  // Initial sync (deferred well past first paint) + 5-minute interval
  useEffect(() => {
    if (!user?.id) return;
    // Defer initial sync so it doesn't compete with first paint / data loads
    const idle = (cb: () => void) => {
      if (typeof (window as any).requestIdleCallback === 'function') {
        (window as any).requestIdleCallback(cb, { timeout: 4000 });
      } else {
        setTimeout(cb, 3500);
      }
    };
    let cancelled = false;
    idle(() => { if (!cancelled) brokerAutoSync(true); });
    const interval = setInterval(() => brokerAutoSync(), 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user?.id, brokerAutoSync]);


  // Fetch broker balance/equity when a broker account is selected + realtime updates
  useEffect(() => {
    if (!selectedBrokerAccountId) {
      setBrokerBalance(null);
      setBrokerEquity(null);
      setBrokerFloatingPl(0);
      setBrokerHasOpenPositions(false);
      return;
    }
    let brokerConnectionId: string | null = null;

    const fetchOpenPositions = async (connId: string) => {
      const { data: positions } = await supabase
        .from('broker_positions')
        .select('floating_pl')
        .eq('broker_connection_id', connId)
        .is('closed_at', null);
      const floating = (positions || []).reduce(
        (sum, p) => sum + Number(p.floating_pl || 0),
        0
      );
      setBrokerFloatingPl(floating);
      setBrokerHasOpenPositions((positions?.length || 0) > 0);
    };

    const fetchBrokerBalance = async () => {
      const { data } = await supabase
        .from('broker_accounts')
        .select('broker_connection_id')
        .eq('account_id_external', selectedBrokerAccountId)
        .maybeSingle();
      if (data?.broker_connection_id) {
        brokerConnectionId = data.broker_connection_id;
        const { data: conn } = await supabase
          .from('broker_connections')
          .select('account_balance, account_equity, today_gross_pnl, today_net_pnl, today_pnl_synced_at')
          .eq('id', data.broker_connection_id)
          .single();
        if (conn?.account_balance != null) {
          setBrokerBalance(Number(conn.account_balance));
        }
        if (conn?.account_equity != null) {
          setBrokerEquity(Number(conn.account_equity));
        }
        await fetchOpenPositions(data.broker_connection_id);
      }
    };
    fetchBrokerBalance();

    // Subscribe to broker_connections + broker_positions for live updates
    const channel = supabase
      .channel(`dashboard-broker-live-${selectedBrokerAccountId}-${Date.now()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'broker_connections' }, (payload) => {
        if (brokerConnectionId && payload.new.id === brokerConnectionId) {
          if (payload.new.account_balance != null) {
            setBrokerBalance(Number(payload.new.account_balance));
          }
          if (payload.new.account_equity != null) {
            setBrokerEquity(Number(payload.new.account_equity));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broker_positions' }, () => {
        if (brokerConnectionId) fetchOpenPositions(brokerConnectionId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedBrokerAccountId]);



  const accountProjection = useAccountProjection({
    userId: user?.id,
    trades,
    manualAccount: selectedAccount,
    selectedAccountId: selectedBrokerAccountId ? null : selectedAccountId,
    brokerAccountExternalId: selectedBrokerAccountId,
    brokerBalance,
    brokerEquity,
    updateManualAccount: updateAccount,
  });
  
  // Use database-backed notebook entries
  const { 
    entries: notebookEntries, 
    saveEntry: saveNotebookEntry, 
    deleteEntry: deleteNotebookEntry,
    isLoading: notebookLoading 
  } = useNotebookEntries(user?.id);
  
  // Use database-backed checklists
  const { checklists } = useChecklists();
  
  // Use database-backed user settings (syncs across devices)
  const { 
    settings,
    setTheme,
    setAccentColor,
    setCustomColor,
    setCustomAccent,
    setCustomGradient,
    setSidebarCollapsed,
    setNotebookFont,
  } = useUserSettings(user?.id);
  
  const handleThemeChange = useThemeChange(setTheme);
  const { theme, accentColor, customColor, customGradient, sidebarCollapsed, notebookFont } = settings;
  
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [journalFilter, setJournalFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [journalDateRange, setJournalDateRange] = useState<{ start: Date; end: Date } | null>(null);

  // Compare view state — hydrated from URL so the view is shareable.
  const [compareOpen, setCompareOpen] = useState(false);
  const [comparePickerOpen, setComparePickerOpen] = useState<boolean>(false);
  // When the user picks two months, we feed those date ranges into CompareView
  // as initialA / initialB (overriding URL hydration for that single open).
  const [pickerInitial, setPickerInitial] = useState<{
    a: { start: Date; end: Date };
    b: { start: Date; end: Date };
  } | null>(null);
  // Optional initial selection passed to the YearMonthPicker when re-opened
  // from the Compare view's "Edit periods" button.
  const [pickerSelection, setPickerSelection] = useState<
    { month: number; year: number }[] | undefined
  >(undefined);
  /** Bumps when the user confirms a new A/B month pair so CompareView remounts. */
  const [compareRevision, setCompareRevision] = useState(0);

  const showJournalWinLossFilter = !compareOpen;

  const journalBaseTrades = useMemo(() => {
    if (!journalDateRange) return trades;
    const startStr = formatLocalDateKey(journalDateRange.start);
    const endStr = formatLocalDateKey(journalDateRange.end);
    return trades.filter((t) => {
      const d = getTradeCloseLocalDateKey(t);
      return d >= startStr && d <= endStr;
    });
  }, [trades, journalDateRange]);

  const journalViewData = useMemo(() => {
    const activeFilter = showJournalWinLossFilter ? journalFilter : 'all';
    const winLossFiltered =
      activeFilter === 'all'
        ? journalBaseTrades
        : activeFilter === 'wins'
          ? journalBaseTrades.filter((t) => t.result > 0)
          : journalBaseTrades.filter((t) => t.result < 0);

    const rangeFiltered = winLossFiltered;

    // Broker day totals only apply when that broker account is selected —
    // otherwise days from other accounts would bleed into this calendar.
    const pnlMap = buildDailyPnLMap(
      rangeFiltered,
      selectedBrokerAccountId ? brokerDayTotals : null,
    );

    return {
      rangeFiltered,
      dayPnLs: Array.from(pnlMap.entries()).map(([date, pnl]) => ({ date, pnl })),
    };
  }, [journalBaseTrades, journalFilter, showJournalWinLossFilter, brokerDayTotals, selectedBrokerAccountId]);

  const { data: allUserTrades = [] } = useQuery({
    queryKey: queryKeys.trades.list(user?.id ?? '', null, null),
    queryFn: () => fetchTradesList(user!.id, null, null),
    enabled: compareOpen && !!user?.id,
    staleTime: 60_000,
  });

  // Notes are now manually created only — no automatic generation for trades

  // Change page without forcing the sidebar to collapse — keeps nav visible on load and during navigation
  const closeCompareView = useCallback(() => {
    clearCompareFromURL();
    setCompareOpen(false);
    setComparePickerOpen(false);
    setPickerInitial(null);
    setPickerSelection(undefined);
    setCompareRevision(0);
  }, []);

  const handlePageChange = useCallback((page: string) => {
    closeCompareView();
    setCurrentPage(page);
  }, [closeCompareView]);

  useEffect(() => {
    if (currentPage !== 'journal' && compareOpen) {
      closeCompareView();
    }
  }, [currentPage, compareOpen, closeCompareView]);

  // Fetch user profile
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setProfileLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isMarketingPreview) {
      setUser(PREVIEW_USER);
      setSession({ user: PREVIEW_USER } as Session);
      setAuthReady(true);
      return;
    }

    let cancelled = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        setSession(session);
        setUser(session?.user ?? null);
        setAuthReady(true);

        if (session?.user) {
          // Defer Supabase calls with setTimeout to avoid deadlock
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setUserProfile(null);
          setProfileLoaded(false);
          navigate('/');
        }
      }
    );

    // THEN check for existing session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        setSession(session);
        setUser(session?.user ?? null);
        setAuthReady(true);

        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          navigate('/');
        }
      })
      .catch((err) => {
        console.error("Auth session check failed:", err);
        if (!cancelled) {
          setAuthReady(true);
          navigate('/auth');
        }
      });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate, fetchProfile]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Signed out successfully");
      navigate('/auth');
    }
  };

  const handleAddTrade = useCallback(async (tradeData: Omit<Trade, 'id'>) => {
    if (editingTrade) {
      // Preserve broker fields when editing an imported trade
      const updateData: Partial<Trade> = {
        ...tradeData,
      };
      if (editingTrade.importedFromBroker) {
        updateData.brokerName = editingTrade.brokerName;
        updateData.brokerEnvironment = editingTrade.brokerEnvironment;
        updateData.brokerAccountId = editingTrade.brokerAccountId;
        updateData.brokerAccNum = editingTrade.brokerAccNum;
        updateData.brokerOrderId = editingTrade.brokerOrderId;
        updateData.brokerPositionId = editingTrade.brokerPositionId;
        updateData.importedFromBroker = editingTrade.importedFromBroker;
        updateData.lastBrokerSyncAt = editingTrade.lastBrokerSyncAt;
        updateData.executionType = editingTrade.executionType;
        updateData.swap = editingTrade.swap;
        updateData.commission = editingTrade.commission;
        updateData.openPrice = editingTrade.openPrice;
        updateData.closePrice = editingTrade.closePrice;
      }
      const success = await updateTrade(editingTrade.id, updateData);
      if (success) {
        // Update linked notebook entry if exists
        const linkedEntry = notebookEntries.find(e => e.tradeId === editingTrade.id);
        if (linkedEntry) {
          await saveNotebookEntry({
            ...linkedEntry,
            title: `${tradeData.pair} - ${tradeData.direction} Trade`,
            date: tradeData.date,
            updatedAt: new Date().toISOString(),
          });
        }
        setEditingTrade(null);
      }
    } else {
      const newTrade = await addTrade(tradeData);
      if (newTrade) {
        setSelectedTradeId(newTrade.id);
        // Notes are created manually by the user via the "Note" button on the Trade Log
      }
    }
  }, [editingTrade, addTrade, updateTrade, notebookEntries, saveNotebookEntry]);

  const handleDeleteTrade = useCallback(async (id: string) => {
    const success = await deleteTrade(id);
    if (success) {
      // Also delete linked notebook entry
      const linkedEntry = notebookEntries.find(e => e.tradeId === id);
      if (linkedEntry) {
        await deleteNotebookEntry(linkedEntry.id);
      }
      if (selectedTradeId === id) {
        setSelectedTradeId(trades.length > 1 ? trades.find(t => t.id !== id)?.id || null : null);
      }
    }
  }, [selectedTradeId, trades, deleteTrade, notebookEntries, deleteNotebookEntry]);

  const handleClearAll = useCallback(async () => {
    const success = await clearAllTrades();
    if (success) {
      // Delete all trade-linked notebook entries
      const tradeEntries = notebookEntries.filter(e => e.tradeId);
      for (const entry of tradeEntries) {
        await deleteNotebookEntry(entry.id);
      }
      setSelectedTradeId(null);
    }
  }, [clearAllTrades, notebookEntries, deleteNotebookEntry]);

  const handleSetBalance = useCallback(async (value: number) => {
    if (selectedBrokerAccountId) return;
    if (selectedAccountId) {
      await updateAccount(selectedAccountId, { starting_balance: value });
    }
  }, [selectedAccountId, selectedBrokerAccountId, updateAccount]);

  const handleSaveNotes = useCallback(async (id: string, notes: string) => {
    await updateTrade(id, { notebook: notes });
  }, [updateTrade]);

  const handleSaveEntry = useCallback(async (entry: NotebookEntry) => {
    await saveNotebookEntry(entry);
  }, [saveNotebookEntry]);

  const handleDeleteEntry = useCallback(async (id: string) => {
    await deleteNotebookEntry(id);
  }, [deleteNotebookEntry]);

  const handleSelectForNotebook = useCallback(async (id: string) => {
    // If no note exists for this trade yet, create a blank one so the user can write
    const existing = notebookEntries.find(e => e.tradeId === id && !e.isDeleted);
    if (!existing) {
      const trade = trades.find(t => t.id === id);
      if (trade) {
        const newEntry: NotebookEntry = {
          id: crypto.randomUUID(),
          title: `${trade.pair} - ${trade.direction} Trade`,
          content: '',
          category: 'trade-notes',
          date: trade.date,
          tradeId: trade.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveNotebookEntry(newEntry);
      }
    }
    setSelectedTradeId(id);
    setCurrentPage('notebook');
  }, [notebookEntries, trades, saveNotebookEntry]);

  const { title, subtitle } = pageInfo[currentPage];

  if (!authReady || !session) {
    return <LoadingScreen />;
  }

  // Chart page uses full-width layout
  const isChartPage = currentPage === 'chart';

  return (
    <>
      <Helmet>
        <title>NSYNC Journal - Trading Journal & Notebook</title>
        <meta name="description" content="Track your trades, analyze performance, and keep detailed notes with NSYNC Journal - your personal trading journal." />
      </Helmet>

      {/* Boot overlay — app mounts and loads underneath, then this fades out */}
      <AnimatePresence>{!bootComplete && <LoadingScreen />}</AnimatePresence>

      {/* Star background — visible in side margins and behind glass panels */}
      <ErrorBoundary
        fallback={<div className="app-starfield fixed inset-0 z-0 pointer-events-none" aria-hidden />}
      >
        <Suspense fallback={<div className="app-starfield" aria-hidden />}>
          <AnimatedBackground />
        </Suspense>
      </ErrorBoundary>

      {/* Global Sidebar - works for all pages */}
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={handlePageChange} 
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className={cn(
        "relative z-10 min-h-screen flex flex-col gap-3 p-2 sm:p-3 pb-24 w-full",
        !isChartPage && "lg:p-5 lg:pb-5"
      )}>
        {/* Mobile Header */}
        {!isChartPage && (
          <div className="lg:hidden glass-strong rounded-2xl p-3 sm:p-4 flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center glow-primary shrink-0">
              <svg className="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
                <polyline points="16,7 22,7 22,13" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold gradient-text truncate">NSYNC JOURNAL</h1>
              <p className="text-[10px] text-muted-foreground">Personal Journal</p>
            </div>
          </div>
        )}

        {/* Theme switch for chart page - bottom center */}
        {isChartPage && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10">
            <ThemeToggle onThemeChange={handleThemeChange} />
          </div>
        )}

        <main className={cn(
          "flex-1 transition-[margin-left] duration-300 min-w-0",
          !isChartPage && sidebarCollapsed && "lg:ml-24"
        )}>
          <div className={cn(
            "glass-strong rounded-2xl min-h-[calc(100vh-120px)]",
            isChartPage ? "p-3 sm:p-4 lg:min-h-[calc(100vh-100px)]" : "p-3 sm:p-4 lg:p-6 lg:min-h-[calc(100vh-60px)]"
          )}>
            <div className={cn(
              !isChartPage && "w-full px-0 sm:px-2 lg:px-8 xl:px-12 2xl:px-16"
            )}>
            {!isChartPage && (
              <TopBar
                title={title}
                subtitle={subtitle}
                onThemeChange={handleThemeChange}
                trades={trades}
                showRank={currentPage === 'dashboard'}
                showGreeting={currentPage === 'dashboard'}
                greetingName={userProfile?.first_name || null}
                profileReady={profileLoaded}
                rightSlot={currentPage === 'dashboard' ? (
                  <div className="flex items-center gap-3">
                    <AccountSelector
                      accounts={accounts}
                      selectedAccount={selectedAccount}
                      onSelectAccount={(id) => { handleSetBrokerAccountId(null); setSelectedAccountId(id); }}
                      onSelectBrokerAccount={handleSetBrokerAccountId}
                      onAddAccount={addAccount}
                      onUpdateAccount={updateAccount}
                      onDeleteAccount={deleteAccount}
                      onSetDefault={setDefaultAccount}
                    />
                    <AnimatePresence>
                      {brokerSyncing && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />
                          <span className="text-xs font-medium text-primary">Syncing broker…</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : undefined}
              />
            )}

            <AnimatePresence mode="wait">
              {/* Dashboard Page */}
              {currentPage === 'dashboard' && (
                <PageTransition key="dashboard" className="space-y-6">
                  <motion.div variants={staggerItem}>
                    <BalanceCards
                      trades={trades}
                      startBalance={accountProjection.startBalance}
                      brokerBalance={brokerBalance}
                      brokerEquity={brokerEquity}
                      brokerFloatingPl={brokerFloatingPl}
                      brokerHasOpenPositions={brokerHasOpenPositions}
                      onSetBalance={handleSetBalance}
                      projection={{
                        accountLabel: accountProjection.accountLabel,
                        accountSubtitle: accountProjection.accountSubtitle,
                        isBroker: accountProjection.isBroker,
                        isLoading: accountProjection.isLoading,
                        currentBalance: accountProjection.currentBalance,
                        startBalance: accountProjection.startBalance,
                        goalBalance: accountProjection.goalBalance,
                        profitTarget: accountProjection.profitTarget,
                        metrics: accountProjection.metrics,
                        onSetGoalBalance: accountProjection.setGoalBalance,
                        onSetProfitTarget: accountProjection.setProfitTarget,
                      }}
                    />
                  </motion.div>
                  
                  <motion.div variants={staggerItem}>
                    <DashboardStatsLayout
                      trades={trades}
                      userId={user?.id}
                      brokerDayTotals={selectedBrokerAccountId ? brokerDayTotals : null}
                      brokerConnectionId={selectedBrokerAccountId ? brokerConnectionId : null}
                      notebookEntries={notebookEntries}
                      onUpdateTrade={async (id, updates) => {
                        await updateTrade(id, updates);
                      }}
                      onSaveEntry={handleSaveEntry}
                      onAddTrade={handleAddTrade}
                    />
                  </motion.div>
                </PageTransition>
              )}

              {/* Journal Page */}
              {currentPage === 'journal' && (
                <PageTransition key="journal" className="space-y-6">
                  {/* Header with Account Selector and Add Trade Button */}
                  <motion.div variants={staggerItem} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">Trading Account:</span>
                      <AccountSelector
                        accounts={accounts}
                        selectedAccount={selectedAccount}
                        onSelectAccount={(id) => { handleSetBrokerAccountId(null); setSelectedAccountId(id); }}
                        onSelectBrokerAccount={handleSetBrokerAccountId}
                        onAddAccount={addAccount}
                        onUpdateAccount={updateAccount}
                        onDeleteAccount={deleteAccount}
                        onSetDefault={setDefaultAccount}
                      />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setIsTradeFormOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium text-sm shadow-glow-sm hover:opacity-90 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Add New Trade
                    </motion.button>
                  </motion.div>
                  
                  {/* Filter Tabs — hidden during compare only */}
                  {showJournalWinLossFilter && (
                  <motion.div variants={staggerItem} className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/30 w-fit">
                    {(['all', 'wins', 'losses'] as const).map((filter) => {
                      const isActive = journalFilter === filter;
                      const count =
                        filter === 'all'
                          ? journalBaseTrades.length
                          : filter === 'wins'
                            ? journalBaseTrades.filter((t) => t.result > 0).length
                            : journalBaseTrades.filter((t) => t.result < 0).length;
                      return (
                        <motion.button
                          key={filter}
                          onClick={() => setJournalFilter(filter)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          className={cn(
                            "relative px-4 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 flex items-center gap-1.5",
                            isActive
                              ? "text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="journal-filter-bg"
                              className={cn(
                                "absolute inset-0 rounded-lg",
                                filter === 'wins' ? "bg-primary" : filter === 'losses' ? "bg-destructive" : "bg-primary"
                              )}
                              transition={{ type: "spring", stiffness: 350, damping: 30 }}
                            />
                          )}
                          <span className="relative z-10 capitalize">{filter}</span>
                          <span className={cn(
                            "relative z-10 text-[10px] px-1.5 py-0.5 rounded-full font-mono",
                            isActive ? "bg-white/20" : "bg-muted/60"
                          )}>{count}</span>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                  )}

                  {/* Main Content with Calendar Sidebar */}
                  <motion.div variants={staggerItem} className={cn(compareOpen ? "block w-full" : "flex gap-6")}>
                    {compareOpen ? (
                      <Suspense fallback={<div className="rounded-2xl bg-card/30 border border-border/30 animate-pulse min-h-[400px]" />}>
                        <CompareView
                        key={compareRevision}
                        trades={trades}
                        allAccountTrades={allUserTrades.length ? allUserTrades : trades}
                        accounts={accounts}
                        initialMode={pickerInitial ? "range" : readCompareFromURL(window.location.search)?.mode}
                        initialA={pickerInitial?.a ?? readCompareFromURL(window.location.search)?.a}
                        initialB={pickerInitial?.b ?? readCompareFromURL(window.location.search)?.b}
                        onEditPeriods={({ a, b }) => {
                          setPickerSelection([
                            { month: a.start.getMonth(), year: a.start.getFullYear() },
                            { month: b.start.getMonth(), year: b.start.getFullYear() },
                          ]);
                          setComparePickerOpen(true);
                        }}
                        onClose={closeCompareView}
                        />
                      </Suspense>
                    ) : (
                        <>
                          {/* Trade Table */}
                          <div className="flex-1 min-w-0">
                            <Suspense fallback={<div className="rounded-2xl bg-card/30 border border-border/30 animate-pulse min-h-[300px]" />}>
                              <TradeTable
                              trades={journalViewData.rangeFiltered}
                              notebookEntries={notebookEntries}
                              checklists={checklists}
                              userId={user?.id}
                              onEdit={(trade) => {
                                setEditingTrade(trade);
                                setIsTradeFormOpen(true);
                              }}
                              onDelete={handleDeleteTrade}
                              onSelectForNotebook={handleSelectForNotebook}
                              onUpdateTrade={async (id, updates) => {
                                await updateTrade(id, updates);
                              }}
                              onClearAll={handleClearAll}
                            />
                            </Suspense>
                          </div>

                          {/* Mini Calendar Sidebar */}
                          <div className="hidden lg:block w-64 flex-shrink-0">
                            <MiniCalendar
                              onRangeChange={setJournalDateRange}
                              dayPnLs={journalViewData.dayPnLs}
                              onCompareClick={() => {
                                setPickerSelection(undefined);
                                setComparePickerOpen(true);
                              }}
                            />
                          </div>
                        </>
                    )}
                  </motion.div>

                  {/* Year-view month picker — available from BOTH the sidebar
                      Compare button AND the in-Compare "Edit periods" button. */}
                  <YearMonthPicker
                    open={comparePickerOpen}
                    initialSelection={pickerSelection}
                    accentColor={accentColor}
                    customColor={customColor}
                    customGradient={customGradient}
                    onClose={() => setComparePickerOpen(false)}
                    onConfirm={(a: MonthSelection, b: MonthSelection) => {
                      const aStart = new Date(a.year, a.month, 1);
                      const aEnd = new Date(a.year, a.month + 1, 0);
                      const bStart = new Date(b.year, b.month, 1);
                      const bEnd = new Date(b.year, b.month + 1, 0);
                      setPickerInitial({
                        a: { start: aStart, end: aEnd },
                        b: { start: bStart, end: bEnd },
                      });
                      setComparePickerOpen(false);
                      setPickerSelection(undefined);
                      setCompareOpen(true);
                      setCompareRevision((r) => r + 1);
                    }}
                  />

                  {/* Trade Form Modal */}
                  <TradeFormModal
                    isOpen={isTradeFormOpen}
                    onClose={() => {
                      setIsTradeFormOpen(false);
                      setEditingTrade(null);
                    }}
                    editingTrade={editingTrade}
                    userId={user?.id}
                    onSubmit={handleAddTrade}
                    onCancelEdit={() => setEditingTrade(null)}
                  />
                </PageTransition>
              )}

              {/* Notebook Page */}
              {currentPage === 'notebook' && (
                <PageTransition key="notebook">
                  <Suspense fallback={<PageFallback />}>
                    <NotebookView
                      trades={trades}
                      userId={user?.id}
                      selectedTradeId={selectedTradeId}
                      onSelectTrade={setSelectedTradeId}
                      onSaveNotes={handleSaveNotes}
                      notebookEntries={notebookEntries}
                      onSaveEntry={handleSaveEntry}
                      onDeleteEntry={handleDeleteEntry}
                      notebookFont={notebookFont}
                      onFontChange={setNotebookFont}
                    />
                  </Suspense>
                </PageTransition>
              )}

              {/* Playbook Page */}
              {currentPage === 'playbook' && (
                <PageTransition key="playbook">
                  <Suspense fallback={<PageFallback />}>
                    <PlaybookView />
                  </Suspense>
                </PageTransition>
              )}

              {/* Economic Calendar Page */}
              {currentPage === 'calendar' && (
                <PageTransition key="calendar">
                  <Suspense fallback={<PageFallback />}>
                    <EconomicCalendarView />
                  </Suspense>
                </PageTransition>
              )}

              {/* Settings Page */}
              {currentPage === 'settings' && (
                <PageTransition key="settings">
                  <Suspense fallback={<PageFallback />}>
                    <SettingsView 
                      theme={theme} 
                      onThemeChange={handleThemeChange}
                      accentColor={accentColor}
                      onAccentColorChange={setAccentColor}
                      userProfile={userProfile}
                      onLogout={handleLogout}
                      customColor={customColor}
                      onCustomColorChange={setCustomColor}
                      onCustomAccentChange={setCustomAccent}
                      customGradient={customGradient}
                      onCustomGradientChange={setCustomGradient}
                    />
                  </Suspense>
                </PageTransition>
              )}

              {/* Chart Page */}
              {currentPage === 'chart' && (
                <PageTransition key="chart">
                  <Suspense fallback={<PageFallback />}>
                    <CustomChart />
                  </Suspense>
                </PageTransition>
              )}

              {/* Community Page */}
              {currentPage === 'community' && (
                <PageTransition key="community">
                  <Suspense fallback={<PageFallback />}>
                    <CommunityView />
                  </Suspense>
                </PageTransition>
              )}
            </AnimatePresence>
            </div>
          </div>
        </main>

        {/* Mobile Navigation - hidden on chart page */}
        {!isChartPage && (
          <MobileNav currentPage={currentPage} onPageChange={handlePageChange} />
        )}

      </div>
    </>
  );
};

export default Index;
