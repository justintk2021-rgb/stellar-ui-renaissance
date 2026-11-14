import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Bookmark } from "lucide-react";
import bookLogo from "@/assets/book-logo.webp";
import { supabase } from "@/integrations/supabase/client";
import { appNavItems } from "@/components/Layout/appNav";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import { useDocumentTheme } from "@/hooks/useDocumentTheme";

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
  const theme = useDocumentTheme();
  const isLiquidGlass = theme === "liquid-glass";
  const [userName, setUserName] = useState<string>("NSYNC JOURNAL");
  const [isHovering, setIsHovering] = useState(false);
  const [isPinned, setIsPinned] = useState(!isCollapsed);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsPinned(!isCollapsed);
  }, [isCollapsed]);

  useEffect(() => {
    let cancelled = false;
    let lastUserId: string | null = null;

    const fetchUserName = async (uid: string) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", uid)
        .maybeSingle();
      if (cancelled) return;
      if (profile) {
        const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
        if (fullName.trim()) setUserName(`${fullName}'s Journal`);
      }
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      lastUserId = user.id;
      fetchUserName(user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (uid && uid !== lastUserId) {
        lastUserId = uid;
        fetchUserName(uid);
      } else if (!uid) {
        lastUserId = null;
        setUserName("NSYNC JOURNAL");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
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

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPinned, closeSidebar]);

  const panelBody = (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl">
          <img
            src={bookLogo}
            alt="NSYNC Journal Logo"
            width={48}
            height={48}
            loading="lazy"
            decoding="async"
            className="h-12 w-12 object-contain"
            style={{
              filter: isLiquidGlass
                ? "drop-shadow(0 0 10px rgba(255,255,255,0.35))"
                : "drop-shadow(0 0 8px hsl(var(--primary) / 0.5))",
            }}
          />
        </div>
        <div className="overflow-hidden">
          <h1
            className={cn(
              "truncate text-lg font-bold tracking-wider",
              isLiquidGlass ? "text-white" : "gradient-text",
            )}
          >
            {userName}
          </h1>
          <p className={cn("text-xs", isLiquidGlass ? "text-white/65" : "text-muted-foreground")}>
            Personal Journal
          </p>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Main">
        <span
          className={cn(
            "mb-2 px-3 text-[10px] uppercase tracking-widest",
            isLiquidGlass ? "text-white/55" : "text-muted-foreground",
          )}
        >
          Navigation
        </span>
        {appNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                onPageChange(item.id);
                if (!isPinned || !isDesktopViewport()) closeSidebar();
              }}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300",
                isLiquidGlass
                  ? isActive
                    ? "bg-white text-neutral-800 shadow-sm"
                    : "border border-transparent text-white/90 hover:bg-white/20"
                  : isActive
                    ? "border border-primary/50 bg-gradient-to-r from-primary/20 to-secondary/10 text-foreground shadow-glow-sm"
                    : "border border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon
                aria-hidden
                className={cn(
                  "h-5 w-5 flex-shrink-0 transition-all duration-300",
                  isLiquidGlass
                    ? isActive
                      ? "text-neutral-800"
                      : "text-white/80 group-hover:scale-110"
                    : isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:rotate-6 group-hover:scale-110 group-hover:text-primary",
                )}
              />
              <span className="truncate">{item.label}</span>
              <span
                className={cn(
                  "ml-auto text-xs transition-all duration-300",
                  isActive ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0",
                )}
              >
                ›
              </span>
            </button>
          );
        })}
      </nav>

      <div
        className={cn(
          "px-2 text-[11px]",
          isLiquidGlass ? "text-white/50" : "text-muted-foreground/70",
        )}
      >
        Data stored locally in your browser
      </div>
    </>
  );

  return (
    <>
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed left-0 top-0 z-50 h-full overflow-visible transition-transform duration-300 ease-in-out",
          showSidebar ? "translate-x-0" : "-translate-x-full",
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
          className={cn(
            "absolute left-full top-1/2 z-10 flex h-11 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border backdrop-blur-md transition-colors",
            isLiquidGlass
              ? "border-white/25 bg-white/15 text-white hover:bg-white/25"
              : "border-primary/25 bg-primary/10 text-primary hover:bg-primary/20",
          )}
        >
          <Bookmark className="h-3.5 w-3.5" strokeWidth={1.15} />
        </button>

        <div className={cn("h-full", isLiquidGlass ? "p-3 lg:p-3" : "p-4 lg:p-0")}>
          {isLiquidGlass ? (
            <LiquidGlassCard
              draggable={false}
              glowIntensity="sm"
              shadowIntensity="md"
              blurIntensity="md"
              borderRadius="24px"
              className="perf-contain flex h-full w-64 flex-col gap-6 p-5 lg:w-72"
            >
              {panelBody}
            </LiquidGlassCard>
          ) : (
            <div className="glass-strong perf-contain relative flex h-full w-64 flex-col gap-6 rounded-2xl p-5 shadow-card lg:w-72 lg:rounded-none">
              {panelBody}
            </div>
          )}
        </div>
      </aside>

      {showSidebar && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}
    </>
  );
}
