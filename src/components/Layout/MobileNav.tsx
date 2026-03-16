import { cn } from "@/lib/utils";
import { LayoutDashboard, BookOpen, NotebookPen, Settings, BarChart3, ClipboardList, CalendarClock, Calculator, Users } from "lucide-react";

interface MobileNavProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'chart', label: 'Chart', icon: BarChart3 },
  { id: 'calculator', label: 'Calc', icon: Calculator },
  { id: 'calendar', label: 'Calendar', icon: CalendarClock },
  { id: 'community', label: 'Chat', icon: Users },
  { id: 'playbook', label: 'Playbook', icon: ClipboardList },
  { id: 'notebook', label: 'Notes', icon: NotebookPen },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function MobileNav({ currentPage, onPageChange }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden glass-strong border-t border-border/50 px-1 py-2 bg-card/95 backdrop-blur-xl safe-area-bottom">
      <div className="flex justify-between items-center max-w-lg mx-auto">
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
                "relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-200 min-w-0 flex-1",
                isDisabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn(
                "w-5 h-5 shrink-0 transition-all duration-300",
                isDisabled
                  ? ""
                  : isActive 
                    ? "drop-shadow-[0_0_8px_hsl(var(--primary)_/_0.5)] scale-110" 
                    : "active:scale-95"
              )} />
              <span className="text-[9px] font-medium truncate">{item.label}</span>
              {isActive && !isDisabled && (
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
