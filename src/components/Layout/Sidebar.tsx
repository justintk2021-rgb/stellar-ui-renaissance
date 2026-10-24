import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Bookmark } from "lucide-react";
import bookLogo from "@/assets/book-logo.webp";
import { supabase } from "@/integrations/supabase/client";
import { appNavItems } from "@/components/Layout/appNav";

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

function isDesktopViewport() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

export function Sidebar({ currentPage, onPageChange, isCollapsed = true, onToggleCollapse }: SidebarProps) {
  const [userName, setUserName] = useState<string>("NSYNC JOURNAL");
  const [isHovering, setIsHovering] = useState(false);
  const [isPinned, setIsPinned] = useState(!isCollapsed);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsPinned(!isCollapsed);
  }, [isCollapsed]);

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

  const showSidebar = isPinned || isHovering;

  const closeSidebar = useCallback(() => {
    setIsPinned(false);
    setIsHovering(false);
    if (!isCollapsed) {
      onToggleCollapse?.();
    }
  }, [isCollapsed, onToggleCollapse]);

  const handleArrowClick = () => {
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    if (newPinned !== !isCollapsed) {
      onToggleCollapse?.();
    }
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

  // Click-outside closes the drawer on mobile only. Pinned desktop stays open.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDesktopViewport()) return;
      if (
        isPinned &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node) &&
        arrowRef.current &&
        !arrowRef.current.contains(e.target as Node)
      ) {
        closeSidebar();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPinned, closeSidebar]);

  return (
    <>
      {/* Sidebar panel — one bookmark tab peeks when closed and rides the edge when open */}
      <aside 
        ref={sidebarRef}
        className={cn(
          "fixed left-0 top-0 h-full z-50 overflow-visible transition-transform duration-300 ease-in-out",
          showSidebar ? "translate-x-0" : "-translate-x-full"
        )}
        onMouseLeave={handleSidebarLeave}
      >
        <button
          ref={arrowRef}
          type="button"
          onClick={handleArrowClick}
          onMouseEnter={handleArrowHover}
          aria-label={isPinned ? "Unpin navigation" : "Open navigation"}
          aria-expanded={showSidebar}
          className="absolute left-full top-1/2 z-10 flex h-11 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border border-primary/25 bg-primary/10 text-primary backdrop-blur-md transition-colors hover:bg-primary/20"
        >
          <Bookmark className="h-3.5 w-3.5" strokeWidth={1.15} />
        </button>
        <div className="h-full p-4 lg:p-0">
          <div className="glass-strong perf-contain rounded-2xl lg:rounded-none p-5 flex flex-col gap-6 shadow-card h-full w-64 lg:w-72 relative">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                <img 
                  src={bookLogo} 
                  alt="NSYNC Journal Logo"
                  width={48}
                  height={48}
                  loading="lazy"
                  decoding="async"
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
            <nav className="flex-1 flex flex-col gap-1 overflow-y-auto min-h-0">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-3">
                Navigation
              </span>
              {appNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onPageChange(item.id);
                      if (!isPinned || !isDesktopViewport()) closeSidebar();
                    }}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 group",
                      isActive
                        ? "bg-gradient-to-r from-primary/20 to-secondary/10 border border-primary/50 text-foreground shadow-glow-sm"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                    )}
                  >
                    <Icon className={cn(
                      "w-5 h-5 flex-shrink-0 transition-all duration-300",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-primary group-hover:scale-110 group-hover:rotate-6"
                    )} />
                    <span className="truncate">{item.label}</span>
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
          </div>
        </div>
      </aside>

      {/* Backdrop when sidebar is open on mobile */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}
    </>
  );
}