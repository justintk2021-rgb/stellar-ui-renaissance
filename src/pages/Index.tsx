import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Trade, NotebookEntry } from "@/types/trade";
import { useThemeTransition } from "@/hooks/useThemeTransition";
import { useTrades } from "@/hooks/useTrades";
import { useTradingAccounts } from "@/hooks/useTradingAccounts";
import { useNotebookEntries } from "@/hooks/useNotebookEntries";
import { useUserSettings, AccentColor } from "@/hooks/useUserSettings";
import { useChecklists } from "@/hooks/useChecklists";
import { Sidebar } from "@/components/Layout/Sidebar";
import { MobileNav } from "@/components/Layout/MobileNav";
import { TopBar } from "@/components/Layout/TopBar";
import { BalanceCards } from "@/components/Dashboard/BalanceCards";
import { DashboardStatsLayout } from "@/components/Dashboard/DashboardStatsLayout";
import { AnimatedBackground } from "@/components/Layout/AnimatedBackground";
import { TradeFormModal } from "@/components/Journal/TradeFormModal";
import { TradeTable } from "@/components/Journal/TradeTable";
import { MiniCalendar } from "@/components/Journal/MiniCalendar";
import { AccountSelector } from "@/components/Dashboard/AccountSelector";

// Lazy-load heavy/secondary pages so the dashboard paints instantly.
const NotebookView = lazy(() => import("@/components/Notebook/NotebookView").then(m => ({ default: m.NotebookView })));
const SettingsView = lazy(() => import("@/components/Settings/SettingsView").then(m => ({ default: m.SettingsView })));
const CustomChart = lazy(() => import("@/components/Chart/CustomChart").then(m => ({ default: m.CustomChart })));
const PlaybookView = lazy(() => import("@/components/Playbook/PlaybookView").then(m => ({ default: m.PlaybookView })));
const EconomicCalendarView = lazy(() => import("@/components/EconomicCalendar/EconomicCalendarView").then(m => ({ default: m.EconomicCalendarView })));
const LotSizeCalculator = lazy(() => import("@/components/Calculator/LotSizeCalculator").then(m => ({ default: m.LotSizeCalculator })));
const CommunityView = lazy(() => import("@/components/Community/CommunityView").then(m => ({ default: m.CommunityView })));

import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PageTransition, staggerItem } from "@/components/Layout/PageTransition";
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
  calculator: { title: 'Calculator', subtitle: 'Calculate position size and risk' },
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

const Index = () => {
  const navigate = useNavigate();
  const { setThemeWithTransition } = useThemeTransition();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedBrokerAccountId, setSelectedBrokerAccountId] = useState<string | null>(() => {
    return localStorage.getItem('selectedBrokerAccountId') || null;
  });
  const [brokerBalance, setBrokerBalance] = useState<number | null>(null);
  const [brokerEquity, setBrokerEquity] = useState<number | null>(null);
  const [brokerFloatingPl, setBrokerFloatingPl] = useState<number>(0);
  const [brokerHasOpenPositions, setBrokerHasOpenPositions] = useState<boolean>(false);
  const [brokerSyncing, setBrokerSyncing] = useState(false);

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
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', 'tradelocker')
        .eq('connection_status', 'connected');

      if (!connections?.length) return;

      setBrokerSyncing(true);
      // Use raw fetch to bypass the SDK's throw-on-non-2xx behavior, which
      // otherwise surfaces as an uncaught runtime error in the dev overlay.
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
      const anonKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;

      await Promise.allSettled(
        connections.map(async (conn) => {
          try {
            const res = await fetch(`${supabaseUrl}/functions/v1/tradelocker`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: anonKey,
                Authorization: `Bearer ${token ?? anonKey}`,
              },
              body: JSON.stringify({ action: 'sync', connectionId: conn.id }),
            });
            if (res.status === 401) {
              await supabase
                .from('broker_connections')
                .update({ connection_status: 'expired' })
                .eq('id', conn.id);
            }
            // Drain the body so the connection can be reused; ignore content.
            try { await res.text(); } catch {}
          } catch {
            // Network errors silently ignored — surfaced via Broker Management UI.
          }
        })
      );
    } catch (e) {
      console.warn('Auto broker sync check failed:', e);
    } finally {
      setBrokerSyncing(false);
      inFlightSyncRef.current = false;
    }
  }, [user?.id]);

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
          .select('account_balance, account_equity')
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


  // Use the account's starting balance (manual accounts only; broker accounts derive it)
  const accountStartBalance = selectedAccount?.starting_balance || 10000;
  
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
    isInitialized: settingsInitialized,
    setTheme,
    setAccentColor,
    setCustomColor,
    setCustomGradient,
    setSidebarCollapsed,
    setNotebookFont,
  } = useUserSettings(user?.id);
  
  const { theme, accentColor, customColor, customGradient, sidebarCollapsed, notebookFont } = settings;
  
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [journalFilter, setJournalFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [journalDateRange, setJournalDateRange] = useState<{ start: Date; end: Date } | null>(null);

  // Notes are now manually created only — no automatic generation for trades

  // Change page without forcing the sidebar to collapse — keeps nav visible on load and during navigation
  const handlePageChange = useCallback((page: string) => {
    setCurrentPage(page);
  }, []);

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
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer Supabase calls with setTimeout to avoid deadlock
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setUserProfile(null);
          navigate('/');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, fetchProfile]);

  // Apply theme and accent color to document
  useEffect(() => {
    if (!settingsInitialized) return;
    
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    
    // Remove all accent classes and add the current one
    const accentClasses = ['accent-emerald', 'accent-blue', 'accent-purple', 'accent-pink', 'accent-red', 'accent-orange', 'accent-yellow', 'accent-cyan', 'accent-custom'];
    accentClasses.forEach(cls => document.documentElement.classList.remove(cls));
    document.documentElement.classList.add(`accent-${accentColor}`);

    // Clear any inline custom styles when switching to a preset accent color
    if (accentColor !== 'custom') {
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--primary-glow');
      document.documentElement.style.removeProperty('--ring');
      document.documentElement.style.removeProperty('--sidebar-primary');
      document.documentElement.style.removeProperty('--sidebar-ring');
    } else {
      // Apply custom color/gradient from database
      const hexToHsl = (hex: string): string => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return '158 64% 51%';
        let r = parseInt(result[1], 16) / 255;
        let g = parseInt(result[2], 16) / 255;
        let b = parseInt(result[3], 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
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

      if (customGradient) {
        const fromHsl = hexToHsl(customGradient.from);
        const toHsl = hexToHsl(customGradient.to);
        document.documentElement.style.setProperty('--primary', fromHsl);
        document.documentElement.style.setProperty('--primary-glow', toHsl);
        document.documentElement.style.setProperty('--ring', fromHsl);
        document.documentElement.style.setProperty('--sidebar-primary', fromHsl);
        document.documentElement.style.setProperty('--sidebar-ring', fromHsl);
      } else if (customColor) {
        const hsl = hexToHsl(customColor);
        document.documentElement.style.setProperty('--primary', hsl);
        document.documentElement.style.setProperty('--primary-glow', hsl);
        document.documentElement.style.setProperty('--ring', hsl);
        document.documentElement.style.setProperty('--sidebar-primary', hsl);
        document.documentElement.style.setProperty('--sidebar-ring', hsl);
      }
    }
  }, [theme, accentColor, customColor, customGradient, settingsInitialized]);

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
    if (selectedAccountId) {
      await updateAccount(selectedAccountId, { starting_balance: value });
    }
  }, [selectedAccountId, updateAccount]);

  const handleSetGoalBalance = useCallback(async (value: number) => {
    if (selectedAccountId) {
      await updateAccount(selectedAccountId, { goal_balance: value });
    }
  }, [selectedAccountId, updateAccount]);

  const handleSetProfitTarget = useCallback(async (value: number) => {
    if (selectedAccountId) {
      await updateAccount(selectedAccountId, { profit_target: value });
    }
  }, [selectedAccountId, updateAccount]);

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

  // Show nothing while checking auth
  if (!session) {
    return null;
  }

  // Chart page uses full-width layout
  const isChartPage = currentPage === 'chart';

  return (
    <>
      <Helmet>
        <title>NSYNC Journal - Trading Journal & Notebook</title>
        <meta name="description" content="Track your trades, analyze performance, and keep detailed notes with NSYNC Journal - your personal trading journal." />
      </Helmet>

      {/* Animated Stars Background */}
      <AnimatedBackground />

      {/* Global Sidebar - works for all pages */}
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={handlePageChange} 
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className={cn(
        "min-h-screen flex flex-col gap-3 p-2 sm:p-3 pb-24 transition-all duration-300 w-full",
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
            <ThemeToggle
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setThemeWithTransition(checked ? 'dark' : 'light', setTheme)}
            />
          </div>
        )}

        <main className={cn(
          "flex-1 transition-all duration-300 min-w-0",
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
                theme={theme}
                onThemeChange={(newTheme) => setThemeWithTransition(newTheme, setTheme)}
                trades={trades}
                showRank={currentPage === 'dashboard'}
                showGreeting={currentPage === 'dashboard'}
                greetingName={userProfile?.first_name || null}
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
                      startBalance={accountStartBalance}
                      goalBalance={selectedAccount?.goal_balance || null}
                      profitTarget={selectedAccount?.profit_target || null}
                      brokerBalance={brokerBalance}
                      brokerEquity={brokerEquity}
                      brokerFloatingPl={brokerFloatingPl}
                      brokerHasOpenPositions={brokerHasOpenPositions}
                      onSetBalance={handleSetBalance}
                      onSetGoalBalance={handleSetGoalBalance}
                      onSetProfitTarget={handleSetProfitTarget}
                    />
                  </motion.div>
                  
                  <motion.div variants={staggerItem}>
                    <DashboardStatsLayout
                      trades={trades}
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
                  
                  {/* Filter Tabs */}
                  <motion.div variants={staggerItem} className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/30 w-fit">
                    {(['all', 'wins', 'losses'] as const).map((filter) => {
                      const isActive = journalFilter === filter;
                      const count = filter === 'all' ? trades.length : filter === 'wins' ? trades.filter(t => t.result > 0).length : trades.filter(t => t.result < 0).length;
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

                  {/* Main Content with Calendar Sidebar */}
                  <motion.div variants={staggerItem} className="flex gap-6">
                    {/* Trade Table */}
                    <div className="flex-1 min-w-0">
                      <TradeTable
                        trades={(() => {
                          const base = journalFilter === 'all' ? trades : journalFilter === 'wins' ? trades.filter(t => t.result > 0) : trades.filter(t => t.result < 0);
                          if (!journalDateRange) return base;
                          const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                          const startStr = fmt(journalDateRange.start);
                          const endStr = fmt(journalDateRange.end);
                          return base.filter(t => {
                            const d = (t.date || '').slice(0, 10);
                            return d >= startStr && d <= endStr;
                          });
                        })()}
                        notebookEntries={notebookEntries}
                        checklists={checklists}
                        onEdit={(trade) => {
                          setEditingTrade(trade);
                          setIsTradeFormOpen(true);
                        }}
                        onDelete={handleDeleteTrade}
                        onSelectForNotebook={handleSelectForNotebook}
                        onClearAll={handleClearAll}
                      />
                    </div>
                    
                    {/* Mini Calendar Sidebar */}
                    <div className="hidden lg:block w-64 flex-shrink-0">
                      <MiniCalendar 
                        onRangeChange={setJournalDateRange}
                        dayPnLs={(() => {
                          const filteredTrades = journalFilter === 'all' ? trades : journalFilter === 'wins' ? trades.filter(t => t.result > 0) : trades.filter(t => t.result < 0);
                          const pnlByDate: Record<string, number> = {};
                          filteredTrades.forEach(t => {
                            pnlByDate[t.date] = (pnlByDate[t.date] || 0) + (t.result || 0);
                          });
                          return Object.entries(pnlByDate).map(([date, pnl]) => ({ date, pnl }));
                        })()}
                      />
                    </div>
                  </motion.div>

                  {/* Trade Form Modal */}
                  <TradeFormModal
                    isOpen={isTradeFormOpen}
                    onClose={() => {
                      setIsTradeFormOpen(false);
                      setEditingTrade(null);
                    }}
                    editingTrade={editingTrade}
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
                      onThemeChange={(newTheme) => setThemeWithTransition(newTheme, setTheme)}
                      accentColor={accentColor}
                      onAccentColorChange={setAccentColor}
                      userProfile={userProfile}
                      onLogout={handleLogout}
                      customColor={customColor}
                      onCustomColorChange={setCustomColor}
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

              {/* Calculator Page */}
              {currentPage === 'calculator' && (
                <PageTransition key="calculator" className="max-w-5xl mx-auto">
                  <Suspense fallback={<PageFallback />}>
                    <LotSizeCalculator />
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
          <MobileNav currentPage={currentPage} onPageChange={setCurrentPage} />
        )}

      </div>
    </>
  );
};

export default Index;
