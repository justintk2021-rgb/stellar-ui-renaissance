import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, BookOpen, NotebookPen, Settings, BarChart3, ClipboardList, CalendarClock, Calculator, Users } from "lucide-react";
import bookLogo from "@/assets/book-logo.png";
import { supabase } from "@/integrations/supabase/client";

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'journal', label: 'Trade Log', icon: BookOpen },
  { id: 'chart', label: 'Chart', icon: BarChart3 },
  { id: 'calculator', label: 'Calculator', icon: Calculator },
  { id: 'calendar', label: 'Economic Calendar', icon: CalendarClock },
  { id: 'playbook', label: 'Playbook', icon: ClipboardList },
  { id: 'notebook', label: 'Notebook', icon: NotebookPen },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [, setUserName] = useState<string>("NSYNC JOURNAL");

  useEffect(() => {
    let cancelled = false;
    let lastUserId: string | null = null;

    const fetchUserName = async (uid: string) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', uid)
        .maybeSingle();
      if (cancelled) return;
      if (profile) {
        const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
        if (fullName.trim()) setUserName(`${fullName}'s Journal`);
      }
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      lastUserId = user.id;
      fetchUserName(user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (uid && uid !== lastUserId) {
        lastUserId = uid;
        fetchUserName(uid);
      } else if (!uid) {
        lastUserId = null;
        setUserName("NSYNC JOURNAL");
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  return (
    <aside className="hidden lg:block fixed left-0 top-0 h-full z-50 p-3 w-20">
      <div className="glass-strong rounded-2xl flex flex-col gap-6 shadow-card h-full p-3 w-14 items-center">
        {/* Logo */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
          <img
            src={bookLogo}
            alt="NSYNC Journal Logo"
            className="w-10 h-10 object-contain"
            style={{ filter: 'drop-shadow(0 0 8px hsl(var(--primary) / 0.5))' }}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-2 items-center w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            const isDisabled = item.id === 'calendar';

            return (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => !isDisabled && onPageChange(item.id)}
                  disabled={isDisabled}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300",
                    isDisabled
                      ? "text-muted-foreground/50 cursor-not-allowed opacity-50"
                      : isActive
                        ? "bg-gradient-to-r from-primary/20 to-secondary/10 border border-primary/50 text-foreground shadow-glow-sm"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                  )}
                >
                  <Icon className={cn(
                    "w-5 h-5 transition-colors duration-300",
                    isDisabled
                      ? "text-muted-foreground/50"
                      : isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-primary"
                  )} />
                </button>

                {/* Inline hover label — slides in from the left and fades out on leave */}
                <span
                  className={cn(
                    "pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 whitespace-nowrap",
                    "px-3 py-1.5 rounded-lg text-sm font-medium",
                    "glass-strong shadow-card text-foreground border border-border/40",
                    "opacity-0 -translate-x-2 scale-95",
                    "group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100",
                    "transition-all duration-300 ease-out z-50"
                  )}
                >
                  {item.label}
                  {isDisabled && <span className="ml-2 text-[10px] opacity-70">(Soon)</span>}
                </span>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
