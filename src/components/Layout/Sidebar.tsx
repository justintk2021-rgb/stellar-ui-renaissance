import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, BookOpen, NotebookPen, Settings, BarChart3, ClipboardList, CalendarClock } from "lucide-react";
import bookLogo from "@/assets/book-logo.png";
import { supabase } from "@/integrations/supabase/client";

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'chart', label: 'Chart', icon: BarChart3 },
  { id: 'calendar', label: 'Economic Calendar', icon: CalendarClock },
  { id: 'playbook', label: 'Playbook', icon: ClipboardList },
  { id: 'notebook', label: 'Notebook', icon: NotebookPen },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [userName, setUserName] = useState<string>("NSYNC JOURNAL");

  useEffect(() => {
    const fetchUserName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (profile) {
          const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
          if (fullName.trim()) {
            setUserName(`${fullName}'s Journal`);
          }
        }
      }
    };

    fetchUserName();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserName();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <aside className="w-64 lg:w-72 glass-strong rounded-2xl p-5 flex flex-col gap-6 shadow-card">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden">
          <img 
            src={bookLogo} 
            alt="NSYNC Journal Logo" 
            className="w-12 h-12 object-contain"
            style={{ filter: 'drop-shadow(0 0 8px hsl(var(--primary) / 0.5))' }}
          />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-wider gradient-text">{userName}</h1>
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
          const isDisabled = item.id === 'calendar';
          
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onPageChange(item.id)}
              disabled={isDisabled}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group",
                isDisabled
                  ? "text-muted-foreground/50 cursor-not-allowed opacity-50"
                  : isActive
                    ? "bg-gradient-to-r from-primary/20 to-secondary/10 border border-primary/50 text-foreground shadow-glow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
              )}
            >
              <Icon className={cn(
                "w-5 h-5 transition-colors",
                isDisabled
                  ? "text-muted-foreground/50"
                  : isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
              )} />
              <span>{item.label}</span>
              {isDisabled && (
                <span className="ml-auto text-[10px] bg-muted/50 px-1.5 py-0.5 rounded">Soon</span>
              )}
              {!isDisabled && (
                <span className={cn(
                  "ml-auto text-xs transition-all duration-300",
                  isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                )}>
                  ›
                </span>
              )}
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
