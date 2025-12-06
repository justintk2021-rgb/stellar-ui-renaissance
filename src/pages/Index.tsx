import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Trade, NotebookEntry } from "@/types/trade";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useTrades } from "@/hooks/useTrades";
import { Sidebar } from "@/components/Layout/Sidebar";
import { MobileNav } from "@/components/Layout/MobileNav";
import { TopBar } from "@/components/Layout/TopBar";
import { StatsGrid } from "@/components/Dashboard/StatsGrid";
import { EquityChart } from "@/components/Dashboard/EquityChart";
import { PnLCalendar } from "@/components/Dashboard/PnLCalendar";
import { BrokerConnection } from "@/components/Dashboard/BrokerConnection";
import { TradeForm } from "@/components/Journal/TradeForm";
import { TradeTable } from "@/components/Journal/TradeTable";
import { NotebookView } from "@/components/Notebook/NotebookView";
import { SettingsView } from "@/components/Settings/SettingsView";
import { LotSizeCalculator } from "@/components/Calculator/LotSizeCalculator";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

const pageInfo: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your trading performance' },
  journal: { title: 'Journal', subtitle: 'Log and manage your trades' },
  notebook: { title: 'Notebook', subtitle: 'Your personal trading notes and journal' },
  calculator: { title: 'Calculator', subtitle: 'Calculate lot size and risk management' },
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  
  // Use database-backed trades
  const { 
    trades, 
    isLoading: tradesLoading, 
    addTrade, 
    updateTrade, 
    deleteTrade, 
    clearAllTrades, 
    importTrades 
  } = useTrades(user?.id);
  
  const [notebookEntries, setNotebookEntries] = useLocalStorage<NotebookEntry[]>('atp_notebook_v1', []);
  const [startBalance, setStartBalance] = useLocalStorage<number>('atp_start_balance', 10000);
  const [theme, setTheme] = useLocalStorage<'dark' | 'light'>('atp_theme', 'dark');
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

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
          // Defer Supabase calls with setTimeout
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

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

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

  const handleSetBalance = useCallback((value: number) => {
    setStartBalance(value);
  }, [setStartBalance]);

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

  return (
    <>
      <Helmet>
        <title>NSYNC Journal - Trading Journal & Notebook</title>
        <meta name="description" content="Track your trades, analyze performance, and keep detailed notes with NSYNC Journal - your personal trading journal." />
      </Helmet>

      <div className="min-h-screen flex flex-col lg:flex-row gap-4 p-4 lg:p-5 max-w-[1400px] mx-auto pb-24 lg:pb-5">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>

        {/* Mobile Header */}
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

        {/* Main Content */}
        <main className="flex-1">
          <div className="glass-strong rounded-2xl p-5 lg:p-6 min-h-[calc(100vh-120px)] lg:min-h-[calc(100vh-60px)]">
            <TopBar title={title} subtitle={subtitle} />

            {/* Dashboard Page */}
            {currentPage === 'dashboard' && (
              <div className="space-y-6 animate-fade-in">
                <BrokerConnection 
                  onTradesImported={async (importedTrades) => {
                    // Convert MetaApi trades to our format
                    const formattedTrades = importedTrades
                      .filter((t: any) => t.type === 'DEAL_TYPE_BUY' || t.type === 'DEAL_TYPE_SELL')
                      .map((t: any) => ({
                        date: new Date(t.time).toISOString().slice(0, 10),
                        pair: t.symbol || 'Unknown',
                        direction: t.type === 'DEAL_TYPE_BUY' ? 'Long' : 'Short' as 'Long' | 'Short',
                        result: t.profit || 0,
                        session: '',
                        strategy: '',
                        notes: `Imported from broker. Volume: ${t.volume}`,
                      }));
                    
                    if (formattedTrades.length > 0) {
                      await importTrades(formattedTrades);
                    }
                  }}
                />
                <EquityChart
                  trades={trades}
                  startBalance={startBalance}
                  onSetBalance={handleSetBalance}
                />
                <StatsGrid trades={trades} />
                <PnLCalendar 
                  trades={trades} 
                  onUpdateTrade={async (id, updates) => {
                    await updateTrade(id, updates);
                  }}
                />
              </div>
            )}

            {/* Journal Page */}
            {currentPage === 'journal' && (
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.4fr] gap-6 animate-fade-in">
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
            )}

            {/* Notebook Page */}
            {currentPage === 'notebook' && (
              <div className="animate-fade-in">
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

            {/* Settings Page */}
            {currentPage === 'settings' && (
              <SettingsView 
                theme={theme} 
                onThemeChange={setTheme}
                userProfile={userProfile}
                onLogout={handleLogout}
              />
            )}

            {/* Calculator Page */}
            {currentPage === 'calculator' && (
              <LotSizeCalculator />
            )}
          </div>
        </main>

        {/* Mobile Navigation */}
        <MobileNav currentPage={currentPage} onPageChange={setCurrentPage} />
      </div>
    </>
  );
};

export default Index;
