import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, BookOpen, NotebookPen, Settings, BarChart3, ClipboardList, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
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
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'chart', label: 'Chart', icon: BarChart3 },
  { id: 'calendar', label: 'Economic Calendar', icon: CalendarClock },
  { id: 'playbook', label: 'Playbook', icon: ClipboardList },
  { id: 'notebook', label: 'Notebook', icon: NotebookPen },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentPage, onPageChange, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const [userName, setUserName] = useState<string>("NSYNC JOURNAL");
  const [isHovering, setIsHovering] = useState(false);
  const [isPinned, setIsPinned] = useState(!isCollapsed);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLButtonElement>(null);

  // Sync pinned state with collapsed prop
  useEffect(() => {
    setIsPinned(!isCollapsed);
  }, [isCollapsed]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isPinned &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node) &&
        arrowRef.current &&
        !arrowRef.current.contains(e.target as Node)
      ) {
        setIsPinned(false);
        onToggleCollapse?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPinned, onToggleCollapse]);

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

  const showSidebar = isPinned || isHovering;

  const handleArrowClick = () => {
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    onToggleCollapse?.();
  };

  const handleArrowHover = () => {
    if (!isPinned) {
      setIsHovering(true);
    }
  };

  const handleSidebarLeave = () => {
    if (!isPinned) {
      setIsHovering(false);
    }
  };

  return (
    <>
      {/* Arrow toggle - always visible on the left edge */}
      <button
        ref={arrowRef}
        onClick={handleArrowClick}
        onMouseEnter={handleArrowHover}
        className={cn(
          "fixed left-0 top-1/2 -translate-y-1/2 w-6 h-16 bg-primary/90 hover:bg-primary text-primary-foreground flex items-center justify-center rounded-r-lg shadow-lg transition-all duration-200 hover:w-8 z-50",
          showSidebar && "opacity-0 pointer-events-none"
        )}
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Sidebar panel */}
      <aside 
        ref={sidebarRef}
        className={cn(
          "fixed left-0 top-0 h-full z-50 transition-transform duration-300 ease-in-out",
          showSidebar ? "translate-x-0" : "-translate-x-full"
        )}
        onMouseLeave={handleSidebarLeave}
      >
        <div className="h-full p-4">
          <div className="glass-strong rounded-2xl p-5 flex flex-col gap-6 shadow-card h-full w-64 lg:w-72 relative">
            {/* Collapse Toggle Button - same arrow style */}
            {onToggleCollapse && (
              <button
                onClick={handleArrowClick}
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-16 bg-primary/90 hover:bg-primary text-primary-foreground flex items-center justify-center rounded-r-lg shadow-lg transition-all duration-200 hover:w-8 z-10"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                <img 
                  src={bookLogo} 
                  alt="NSYNC Journal Logo" 
                  className="w-12 h-12 object-contain"
                  style={{ filter: 'drop-shadow(0 0 8px hsl(var(--primary) / 0.5))' }}
                />
              </div>
              <div className="overflow-hidden">
                <h1 className="text-lg font-bold tracking-wider gradient-text truncate">{userName}</h1>
                <p className="text-xs text-muted-foreground">Personal Journal</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex flex-col gap-2 overflow-y-auto">
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
                      "w-5 h-5 flex-shrink-0 transition-all duration-300",
                      isDisabled
                        ? "text-muted-foreground/50"
                        : isActive 
                          ? "text-primary" 
                          : "text-muted-foreground group-hover:text-primary group-hover:scale-110 group-hover:rotate-6"
                    )} />
                    <span className="truncate">{item.label}</span>
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
          </div>
        </div>
      </aside>

      {/* Backdrop when sidebar is open on mobile */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => {
            setIsPinned(false);
            setIsHovering(false);
            onToggleCollapse?.();
          }}
        />
      )}
    </>
  );
}