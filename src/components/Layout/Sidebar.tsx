import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, BookOpen, NotebookPen, Settings, BarChart3, ClipboardList, CalendarClock, Calculator, Users } from "lucide-react";
import bookLogo from "@/assets/book-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'chart', label: 'Chart', icon: BarChart3 },
  { id: 'calculator', label: 'Calculator', icon: Calculator },
  { id: 'calendar', label: 'Economic Calendar', icon: CalendarClock },
  { id: 'playbook', label: 'Playbook', icon: ClipboardList },
  { id: 'notebook', label: 'Notebook', icon: NotebookPen },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [userName, setUserName] = useState<string>("NSYNC JOURNAL");
  const [isExpanded, setIsExpanded] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch user name once; re-fetch only when the user actually changes
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

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setIsExpanded(false), 150);
  };

  return (
    <TooltipProvider delayDuration={100}>
      {/* Sidebar panel — hidden on mobile (mobile uses bottom nav), always-visible icon rail on lg+ */}
      <aside
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "hidden lg:block fixed left-0 top-0 h-full z-50 transition-[width] duration-300 ease-in-out p-3",
          isExpanded ? "w-72" : "w-20"
        )}
      >
        <div
          className={cn(
            "glass-strong rounded-2xl flex flex-col gap-6 shadow-card h-full overflow-hidden transition-all duration-300",
            isExpanded ? "p-5 w-64" : "p-3 w-14 items-center"
          )}
        >
          {/* Logo */}
          <div className={cn("flex items-center gap-3", !isExpanded && "justify-center")}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
              <img
                src={bookLogo}
                alt="NSYNC Journal Logo"
                className="w-10 h-10 object-contain"
                style={{ filter: 'drop-shadow(0 0 8px hsl(var(--primary) / 0.5))' }}
              />
            </div>
            {isExpanded && (
              <div className="overflow-hidden">
                <h1 className="text-lg font-bold tracking-wider gradient-text truncate">{userName}</h1>
                <p className="text-xs text-muted-foreground">Personal Journal</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className={cn("flex-1 flex flex-col gap-2 overflow-y-auto overflow-x-hidden w-full", !isExpanded && "items-center")}>
            {isExpanded && (
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-3">
                Navigation
              </span>
            )}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              const isDisabled = item.id === 'calendar';

              const button = (
                <button
                  key={item.id}
                  onClick={() => !isDisabled && onPageChange(item.id)}
                  disabled={isDisabled}
                  className={cn(
                    "flex items-center rounded-xl text-sm font-medium transition-all duration-300 group",
                    isExpanded ? "gap-3 px-4 py-3 w-full" : "justify-center w-10 h-10",
                    isDisabled
                      ? "text-muted-foreground/50 cursor-not-allowed opacity-50"
                      : isActive
                        ? "bg-gradient-to-r from-primary/20 to-secondary/10 border border-primary/50 text-foreground shadow-glow-sm"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                  )}
                >
                  <Icon className={cn(
                    "w-5 h-5 flex-shrink-0 transition-all duration-300",
                    isDisabled
                      ? "text-muted-foreground/50"
                      : isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-primary group-hover:scale-110"
                  )} />
                  {isExpanded && <span className="truncate">{item.label}</span>}
                  {isExpanded && isDisabled && (
                    <span className="ml-auto text-[10px] bg-muted/50 px-1.5 py-0.5 rounded">Soon</span>
                  )}
                  {isExpanded && !isDisabled && (
                    <span className={cn(
                      "ml-auto text-xs transition-all duration-300",
                      isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                    )}>
                      ›
                    </span>
                  )}
                </button>
              );

              if (isExpanded) return <div key={item.id}>{button}</div>;

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}{isDisabled && " (Soon)"}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Footer */}
          {isExpanded && (
            <div className="text-[11px] text-muted-foreground/70 px-2">
              Data stored locally in your browser
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
