import { cn } from "@/lib/utils";
import { LayoutDashboard, BookOpen, NotebookPen, TrendingUp, Settings, Calculator } from "lucide-react";

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'notebook', label: 'Notebook', icon: NotebookPen },
  { id: 'calculator', label: 'Calculator', icon: Calculator },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  return (
    <aside className="w-64 lg:w-72 glass-strong rounded-2xl p-5 flex flex-col gap-6 shadow-card">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary via-secondary to-primary flex items-center justify-center glow-primary relative overflow-hidden">
          <TrendingUp className="w-6 h-6 text-primary-foreground relative z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-wider gradient-text">NSYNC JOURNAL</h1>
          <p className="text-xs text-muted-foreground">Personal Journal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-3">
          Navigation
        </span>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group",
                isActive
                  ? "bg-gradient-to-r from-primary/20 to-secondary/10 border border-primary/50 text-foreground shadow-glow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
              )}
            >
              <Icon className={cn(
                "w-5 h-5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
              )} />
              <span>{item.label}</span>
              <span className={cn(
                "ml-auto text-xs transition-all duration-300",
                isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
              )}>
                ›
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="text-[11px] text-muted-foreground/70 px-2">
        Data stored locally in your browser
      </div>
    </aside>
  );
}
