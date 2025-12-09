import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Trade, NotebookEntry } from "@/types/trade";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useThemeTransition } from "@/hooks/useThemeTransition";
import { useTrades } from "@/hooks/useTrades";
import { useTradingAccounts } from "@/hooks/useTradingAccounts";
import { Sidebar } from "@/components/Layout/Sidebar";
import { MobileNav } from "@/components/Layout/MobileNav";
import { TopBar } from "@/components/Layout/TopBar";
import { StatsGrid } from "@/components/Dashboard/StatsGrid";
import { EquityChart } from "@/components/Dashboard/EquityChart";
import { PnLCalendar } from "@/components/Dashboard/PnLCalendar";
import { TradeForm } from "@/components/Journal/TradeForm";
import { TradeTable } from "@/components/Journal/TradeTable";
import { NotebookView } from "@/components/Notebook/NotebookView";
import { SettingsView, AccentColor } from "@/components/Settings/SettingsView";
import { CustomChart } from "@/components/Chart/CustomChart";
import { TradingAssistant } from "@/components/AI/TradingAssistant";
import { PlaybookView } from "@/components/Playbook/PlaybookView";
import { EconomicCalendarView } from "@/components/EconomicCalendar/EconomicCalendarView";
import { AccountSelector } from "@/components/Dashboard/AccountSelector";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

const pageInfo: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your trading performance' },
  journal: { title: 'Journal', subtitle: 'Log and manage your trades' },
  chart: { title: 'Chart', subtitle: 'Interactive chart with drawing tools' },
  calendar: { title: 'Economic Calendar', subtitle: 'Live economic news and events' },
  playbook: { title: 'Playbook', subtitle: 'Your trading checklists and rules' },
  notebook: { title: 'Notebook', subtitle: 'Your personal trading notes and journal' },
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
  
  // Use database-backed trades filtered by selected account
  const { 
    trades, 
    isLoading: tradesLoading, 
    addTrade, 
    updateTrade, 
    deleteTrade, 
    clearAllTrades, 
    importTrades 
  } = useTrades(user?.id, selectedAccountId);
  
  // Use the account's starting balance
  const accountStartBalance = selectedAccount?.starting_balance || 10000;
  
  const [notebookEntries, setNotebookEntries] = useLocalStorage<NotebookEntry[]>('atp_notebook_v1', []);
  const [theme, setTheme] = useLocalStorage<'dark' | 'light'>('atp_theme', 'dark');
  const [accentColor, setAccentColor] = useLocalStorage<AccentColor>('atp_accent_color', 'emerald');
  const [customColor, setCustomColor] = useLocalStorage<string>('atp_custom_color', '#10b981');
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage<boolean>('atp_sidebar_collapsed', false);

  // Close sidebar when changing page
  const handlePageChange = useCallback((page: string) => {
    setCurrentPage(page);
    setSidebarCollapsed(true);
  }, [setSidebarCollapsed]);

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
          navigate('/auth');
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
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, fetchProfile]);

  // Apply theme and accent color to document
  useEffect(() => {
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
      // Apply saved custom gradient on page load
      const savedGradient = localStorage.getItem('atp_custom_gradient');
      if (savedGradient) {
        try {
          const gradient = JSON.parse(savedGradient);
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
          const fromHsl = hexToHsl(gradient.from);
          const toHsl = hexToHsl(gradient.to);
          document.documentElement.style.setProperty('--primary', fromHsl);
          document.documentElement.style.setProperty('--primary-glow', toHsl);
          document.documentElement.style.setProperty('--ring', fromHsl);
          document.documentElement.style.setProperty('--sidebar-primary', fromHsl);
          document.documentElement.style.setProperty('--sidebar-ring', fromHsl);
        } catch {
          // ignore
        }
      }
    }
  }, [theme, accentColor]);

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
      const success = await updateTrade(editingTrade.id, tradeData);
      if (success) {
        // Update linked notebook entry if exists
        setNotebookEntries(prev => prev.map(entry => {
          if (entry.tradeId === editingTrade.id) {
            return {
              ...entry,
              title: `${tradeData.pair} - ${tradeData.direction} Trade`,
              date: tradeData.date,
              updatedAt: new Date().toISOString(),
            };
          }
          return entry;
        }));
        setEditingTrade(null);
      }
    } else {
      const newTrade = await addTrade(tradeData);
      if (newTrade) {
        setSelectedTradeId(newTrade.id);
        
        // Auto-create notebook entry for this trade
        const newEntry: NotebookEntry = {
          id: `trade-note-${newTrade.id}`,
          title: `${tradeData.pair} - ${tradeData.direction} Trade`,
          content: `<h2>📋 Trade Plan</h2>
<ul>
  <li>Why did I take this trade?</li>
  <li>What was my setup/strategy?</li>
</ul>

<h2>⚙️ Execution</h2>
<ul>
  <li>Entry point and reasoning</li>
  <li>Trade management</li>
  <li>Exit point</li>
</ul>

<h2>🧠 Post-Trade Review</h2>
<ul>
  <li>What went well?</li>
  <li>What could be improved?</li>
  <li>Key lessons learned</li>
</ul>`,
          category: "trade-notes",
          date: tradeData.date,
          tradeId: newTrade.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setNotebookEntries(prev => [newEntry, ...prev]);
      }
    }
  }, [editingTrade, addTrade, updateTrade, setNotebookEntries]);

  const handleDeleteTrade = useCallback(async (id: string) => {
    const success = await deleteTrade(id);
    if (success) {
      // Also delete linked notebook entry
      setNotebookEntries(prev => prev.filter(e => e.tradeId !== id));
      if (selectedTradeId === id) {
        setSelectedTradeId(trades.length > 1 ? trades.find(t => t.id !== id)?.id || null : null);
      }
    }
  }, [selectedTradeId, trades, deleteTrade, setNotebookEntries]);

  const handleClearAll = useCallback(async () => {
    const success = await clearAllTrades();
    if (success) {
      setNotebookEntries(prev => prev.filter(e => !e.tradeId));
      setSelectedTradeId(null);
    }
  }, [clearAllTrades, setNotebookEntries]);

  const handleSetBalance = useCallback(async (value: number) => {
    if (selectedAccountId) {
      await updateAccount(selectedAccountId, { starting_balance: value });
    }
  }, [selectedAccountId, updateAccount]);

  const handleSaveNotes = useCallback(async (id: string, notes: string) => {
    await updateTrade(id, { notebook: notes });
  }, [updateTrade]);

  const handleSaveEntry = useCallback((entry: NotebookEntry) => {
    setNotebookEntries(prev => {
      const existing = prev.find(e => e.id === entry.id);
      if (existing) {
        return prev.map(e => e.id === entry.id ? entry : e);
      }
      return [entry, ...prev];
    });
  }, [setNotebookEntries]);

  const handleDeleteEntry = useCallback((id: string) => {
    setNotebookEntries(prev => prev.filter(e => e.id !== id));
  }, [setNotebookEntries]);

  const handleSelectForNotebook = useCallback((id: string) => {
    setSelectedTradeId(id);
    setCurrentPage('notebook');
  }, []);

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

      {/* Global Sidebar - works for all pages */}
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={handlePageChange} 
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className={cn(
        "min-h-screen flex flex-col gap-4 p-4 pb-24 transition-all duration-300 w-full",
        !isChartPage && "lg:p-5 lg:pb-5"
      )}>
        {/* Mobile Header */}
        {!isChartPage && (
          <div className="lg:hidden glass-strong rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center glow-primary">
              <svg className="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
                <polyline points="16,7 22,7 22,13" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold gradient-text">NSYNC JOURNAL</h1>
              <p className="text-[10px] text-muted-foreground">Personal Journal</p>
            </div>
          </div>
        )}

        {/* Theme switch for chart page - bottom center */}
        {isChartPage && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 glass-strong rounded-xl px-3 py-2 shadow-lg">
            <Sun className="w-4 h-4 text-muted-foreground" />
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setThemeWithTransition(checked ? 'dark' : 'light', setTheme)}
            />
            <Moon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}

        <main className={cn(
          "flex-1 transition-all duration-300",
          !isChartPage && sidebarCollapsed && "lg:ml-24"
        )}>
          <div className={cn(
            "glass-strong rounded-2xl min-h-[calc(100vh-120px)]",
            isChartPage ? "p-4 lg:min-h-[calc(100vh-100px)]" : "p-5 lg:p-6 lg:min-h-[calc(100vh-60px)]"
          )}>
            {!isChartPage && <TopBar title={title} subtitle={subtitle} theme={theme} onThemeChange={(newTheme) => setThemeWithTransition(newTheme, setTheme)} />}

            {/* Dashboard Page */}
            {currentPage === 'dashboard' && (
              <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
                {/* Account Selector */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <AccountSelector
                    accounts={accounts}
                    selectedAccount={selectedAccount}
                    onSelectAccount={setSelectedAccountId}
                    onAddAccount={addAccount}
                    onUpdateAccount={updateAccount}
                    onDeleteAccount={deleteAccount}
                    onSetDefault={setDefaultAccount}
                  />
                </div>
                
                <EquityChart
                  trades={trades}
                  startBalance={accountStartBalance}
                  onSetBalance={handleSetBalance}
                />
                <StatsGrid trades={trades} />
                <PnLCalendar 
                  trades={trades} 
                  onUpdateTrade={async (id, updates) => {
                    await updateTrade(id, updates);
                  }}
                  notebookEntries={notebookEntries}
                  onSaveEntry={handleSaveEntry}
                />
              </div>
            )}

            {/* Journal Page */}
            {currentPage === 'journal' && (
              <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
                {/* Account Selector for Journal */}
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Trading Account:</span>
                  <AccountSelector
                    accounts={accounts}
                    selectedAccount={selectedAccount}
                    onSelectAccount={setSelectedAccountId}
                    onAddAccount={addAccount}
                    onUpdateAccount={updateAccount}
                    onDeleteAccount={deleteAccount}
                    onSetDefault={setDefaultAccount}
                  />
                </div>
                
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.4fr] gap-6">
                  <TradeForm
                    editingTrade={editingTrade}
                    onSubmit={handleAddTrade}
                    onCancelEdit={() => setEditingTrade(null)}
                  />
                  <TradeTable
                    trades={trades}
                    onEdit={setEditingTrade}
                    onDelete={handleDeleteTrade}
                    onSelectForNotebook={handleSelectForNotebook}
                    onClearAll={handleClearAll}
                  />
                </div>
              </div>
            )}

            {/* Notebook Page */}
            {currentPage === 'notebook' && (
              <div className="animate-fade-in max-w-7xl mx-auto">
                <NotebookView
                  trades={trades}
                  selectedTradeId={selectedTradeId}
                  onSelectTrade={setSelectedTradeId}
                  onSaveNotes={handleSaveNotes}
                  notebookEntries={notebookEntries}
                  onSaveEntry={handleSaveEntry}
                  onDeleteEntry={handleDeleteEntry}
                />
              </div>
            )}

            {/* Playbook Page */}
            {currentPage === 'playbook' && (
              <div className="max-w-7xl mx-auto">
                <PlaybookView />
              </div>
            )}

            {/* Economic Calendar Page */}
            {currentPage === 'calendar' && (
              <div className="max-w-7xl mx-auto">
                <EconomicCalendarView />
              </div>
            )}

            {/* Settings Page */}
            {currentPage === 'settings' && (
              <div className="max-w-7xl mx-auto">
                <SettingsView 
                  theme={theme} 
                  onThemeChange={(newTheme) => setThemeWithTransition(newTheme, setTheme)}
                  accentColor={accentColor}
                  onAccentColorChange={setAccentColor}
                  userProfile={userProfile}
                  onLogout={handleLogout}
                  customColor={customColor}
                  onCustomColorChange={setCustomColor}
                />
              </div>
            )}

            {/* Chart Page */}
            {currentPage === 'chart' && (
              <CustomChart />
            )}
          </div>
        </main>

        {/* Mobile Navigation - hidden on chart page */}
        {!isChartPage && (
          <MobileNav currentPage={currentPage} onPageChange={setCurrentPage} />
        )}

        {/* AI Trading Assistant */}
        <TradingAssistant trades={trades} onAddTrade={handleAddTrade} />
      </div>
    </>
  );
};

export default Index;
