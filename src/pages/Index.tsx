import { useState, useCallback, useEffect } from "react";
import { Trade, NotebookEntry } from "@/types/trade";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Sidebar } from "@/components/Layout/Sidebar";
import { MobileNav } from "@/components/Layout/MobileNav";
import { TopBar } from "@/components/Layout/TopBar";
import { StatsGrid } from "@/components/Dashboard/StatsGrid";
import { EquityChart } from "@/components/Dashboard/EquityChart";
import { PnLCalendar } from "@/components/Dashboard/PnLCalendar";
import { TradeForm } from "@/components/Journal/TradeForm";
import { TradeTable } from "@/components/Journal/TradeTable";
import { NotebookView } from "@/components/Notebook/NotebookView";
import { SettingsView } from "@/components/Settings/SettingsView";
import { Helmet } from "react-helmet";

const pageInfo: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your trading performance' },
  journal: { title: 'Journal', subtitle: 'Log and manage your trades' },
  notebook: { title: 'Notebook', subtitle: 'Your personal trading notes and journal' },
  settings: { title: 'Settings', subtitle: 'Customize your preferences' },
};

const Index = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [trades, setTrades] = useLocalStorage<Trade[]>('atp_trades_v1', []);
  const [notebookEntries, setNotebookEntries] = useLocalStorage<NotebookEntry[]>('atp_notebook_v1', []);
  const [startBalance, setStartBalance] = useLocalStorage<number>('atp_start_balance', 10000);
  const [theme, setTheme] = useLocalStorage<'dark' | 'light'>('atp_theme', 'dark');
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(
    trades.length > 0 ? trades[0].id : null
  );

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  const handleAddTrade = useCallback((tradeData: Omit<Trade, 'id'>) => {
    if (editingTrade) {
      setTrades(prev => prev.map(t => 
        t.id === editingTrade.id ? { ...t, ...tradeData } : t
      ));
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
    } else {
      const tradeId = Date.now().toString();
      const newTrade: Trade = {
        ...tradeData,
        id: tradeId,
      };
      setTrades(prev => [newTrade, ...prev]);
      setSelectedTradeId(newTrade.id);
      
      // Auto-create notebook entry for this trade
      const newEntry: NotebookEntry = {
        id: `trade-note-${tradeId}`,
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
        tradeId: tradeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setNotebookEntries(prev => [newEntry, ...prev]);
    }
  }, [editingTrade, setTrades, setNotebookEntries]);

  const handleDeleteTrade = useCallback((id: string) => {
    setTrades(prev => prev.filter(t => t.id !== id));
    // Also delete linked notebook entry
    setNotebookEntries(prev => prev.filter(e => e.tradeId !== id));
    if (selectedTradeId === id) {
      setSelectedTradeId(trades.length > 1 ? trades.find(t => t.id !== id)?.id || null : null);
    }
  }, [selectedTradeId, trades, setTrades, setNotebookEntries]);

  const handleClearAll = useCallback(() => {
    if (window.confirm('Delete ALL trades? This cannot be undone.')) {
      setTrades([]);
      setSelectedTradeId(null);
    }
  }, [setTrades]);

  const handleSetBalance = useCallback(() => {
    const input = window.prompt('Enter starting balance:', startBalance.toString());
    if (input === null) return;
    const value = parseFloat(input);
    if (!isNaN(value)) {
      setStartBalance(value);
    }
  }, [startBalance, setStartBalance]);

  const handleSaveNotes = useCallback((id: string, notes: string) => {
    setTrades(prev => prev.map(t => 
      t.id === id ? { ...t, notebook: notes } : t
    ));
  }, [setTrades]);

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

  return (
    <>
      <Helmet>
        <title>ATP Trades - Trading Journal & Notebook</title>
        <meta name="description" content="Track your trades, analyze performance, and keep detailed notes with ATP Trades - your personal trading journal." />
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
            <h1 className="text-base font-bold gradient-text">ATP TRADES</h1>
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
                <EquityChart
                  trades={trades}
                  startBalance={startBalance}
                  onSetBalance={handleSetBalance}
                />
                <StatsGrid trades={trades} />
                <PnLCalendar trades={trades} />
              </div>
            )}

            {/* Journal Page */}
            {currentPage === 'journal' && (
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.4fr] gap-6 animate-fade-in">
                <TradeForm
                  editingTrade={editingTrade}
                  onSubmit={handleAddTrade}
                  onCancelEdit={() => setEditingTrade(null)}
                  onClearAll={handleClearAll}
                />
                <TradeTable
                  trades={trades}
                  onEdit={setEditingTrade}
                  onDelete={handleDeleteTrade}
                  onSelectForNotebook={handleSelectForNotebook}
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
              <SettingsView theme={theme} onThemeChange={setTheme} />
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
