import { useEffect, useState, useRef, useCallback, useMemo, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowDownAZ,
  Bookmark,
  Check,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
} from "lucide-react";
import bookLogo from "@/assets/book-logo.webp";
import { supabase } from "@/integrations/supabase/client";
import {
  appNavItems,
  orderNavItems,
  readNavOrder,
  saveNavOrder,
} from "@/components/Layout/appNav";
import { SidebarMusicPlayer } from "@/components/Layout/SidebarMusicPlayer";
import { SidebarRecordPlayer } from "@/components/Layout/SidebarRecordPlayer";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import { useDocumentTheme } from "@/hooks/useDocumentTheme";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ICONS_ONLY_KEY = "atp_sidebar_icons_only";

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  iconsOnly?: boolean;
  onToggleIconsOnly?: () => void;
}

function isDesktopViewport() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

function readIconsOnlyFlag() {
  try {
    return localStorage.getItem(ICONS_ONLY_KEY) === "true";
  } catch {
    return false;
  }
}

export function Sidebar({
  currentPage,
  onPageChange,
  isCollapsed = true,
  onToggleCollapse,
  iconsOnly: iconsOnlyProp,
  onToggleIconsOnly,
}: SidebarProps) {
  const theme = useDocumentTheme();
  const isLiquidGlass = theme === "liquid-glass";
  const [userName, setUserName] = useState<string>("NSYNC JOURNAL");
  const [isHovering, setIsHovering] = useState(false);
  const [isPinned, setIsPinned] = useState(!isCollapsed);
  const [localIconsOnly, setLocalIconsOnly] = useState(readIconsOnlyFlag);
  const [isEditingNav, setIsEditingNav] = useState(false);
  const [navOrder, setNavOrder] = useState<string[]>(
    () => readNavOrder() ?? appNavItems.map((item) => item.id),
  );
  const [draggingNavId, setDraggingNavId] = useState<string | null>(null);
  const [dropNavId, setDropNavId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLButtonElement>(null);

  const iconsOnly = iconsOnlyProp ?? localIconsOnly;
  const orderedNavItems = useMemo(() => orderNavItems(navOrder), [navOrder]);

  const handleNavDragStart = useCallback((event: DragEvent, id: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-sidebar-nav", id);
    event.dataTransfer.setData("text/plain", id);
    setDraggingNavId(id);
  }, []);

  const handleNavDragOver = useCallback((event: DragEvent, id: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropNavId(id);
  }, []);

  const handleNavDrop = useCallback((event: DragEvent, targetId: string) => {
    event.preventDefault();
    const sourceId =
      event.dataTransfer.getData("application/x-sidebar-nav") ||
      event.dataTransfer.getData("text/plain") ||
      draggingNavId;
    setDraggingNavId(null);
    setDropNavId(null);
    if (!sourceId || sourceId === targetId) return;
    setNavOrder((current) => {
      const from = current.indexOf(sourceId);
      const to = current.indexOf(targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, sourceId);
      saveNavOrder(next);
      return next;
    });
  }, [draggingNavId]);

  const handleNavDragEnd = useCallback(() => {
    setDraggingNavId(null);
    setDropNavId(null);
  }, []);

  const sortNavAlphabetical = useCallback(() => {
    const next = [...appNavItems]
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
      .map((item) => item.id);
    setNavOrder(next);
    saveNavOrder(next);
  }, []);

  const setIconsOnly = useCallback(
    (next: boolean) => {
      if (onToggleIconsOnly) {
        if (next !== iconsOnly) onToggleIconsOnly();
        return;
      }
      setLocalIconsOnly(next);
      try {
        localStorage.setItem(ICONS_ONLY_KEY, String(next));
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent("sidebar-icons-only", { detail: next }));
    },
    [iconsOnly, onToggleIconsOnly],
  );

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

  const showSidebar = iconsOnly || isPinned || isHovering;
  const compact = iconsOnly && isDesktopViewport();

  useEffect(() => {
    if (compact && isEditingNav) setIsEditingNav(false);
  }, [compact, isEditingNav]);

  const closeSidebar = useCallback(() => {
    if (iconsOnly) return;
    setIsPinned(false);
    setIsHovering(false);
    if (!isCollapsed) {
      onToggleCollapse?.();
    }
  }, [iconsOnly, isCollapsed, onToggleCollapse]);

  const handleArrowClick = () => {
    // Bookmark / hover control: pin or unpin the full panel — not icons-only.
    if (iconsOnly) {
      setIconsOnly(false);
      if (isCollapsed) onToggleCollapse?.();
      return;
    }
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    if (newPinned !== !isCollapsed) {
      onToggleCollapse?.();
    }
  };

  const handleArrowHover = () => {
    if (!iconsOnly && !isPinned) {
      setIsHovering(true);
    }
  };

  const handleSidebarLeave = () => {
    if (!iconsOnly && !isPinned) {
      setIsHovering(false);
    }
  };

  const handleToggleIconsOnly = () => {
    const next = !iconsOnly;
    if (next && isCollapsed) {
      onToggleCollapse?.();
    }
    setIconsOnly(next);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDesktopViewport()) return;
      if (
        isPinned &&
        !iconsOnly &&
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
  }, [isPinned, iconsOnly, closeSidebar]);

  const panelWidth = compact ? "w-[4.5rem]" : "w-64 lg:w-72";

  const panelBody = (
    <>
      <div className={cn("flex items-center", compact ? "justify-center" : "gap-3")}>
        <div
          className={cn(
            "flex flex-shrink-0 items-center justify-center overflow-hidden rounded-xl",
            compact ? "h-10 w-10" : "h-12 w-12",
          )}
        >
          <img
            src={bookLogo}
            alt="NSYNC Journal Logo"
            width={compact ? 40 : 48}
            height={compact ? 40 : 48}
            loading="lazy"
            decoding="async"
            className={cn("object-contain", compact ? "h-10 w-10" : "h-12 w-12")}
            style={{
              filter: isLiquidGlass
                ? "drop-shadow(0 0 10px rgba(255,255,255,0.35))"
                : "drop-shadow(0 0 8px hsl(var(--primary) / 0.5))",
            }}
          />
        </div>
        {!compact && (
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
        )}
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Main">
        {!compact && (
          <div className="mb-2 flex items-center justify-between gap-2 px-3">
            <span
              className={cn(
                "text-[10px] uppercase tracking-widest",
                isLiquidGlass ? "text-white/55" : "text-muted-foreground",
              )}
            >
              Navigation
            </span>
            <div className="flex items-center gap-0.5">
              {isEditingNav ? (
                <button
                  type="button"
                  onClick={sortNavAlphabetical}
                  aria-label="Sort navigation A to Z"
                  title="Sort A–Z"
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                    isLiquidGlass
                      ? "text-white/60 hover:bg-white/15 hover:text-white"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <ArrowDownAZ className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setIsEditingNav((open) => !open)}
                aria-label={isEditingNav ? "Done editing navigation" : "Edit navigation order"}
                aria-pressed={isEditingNav}
                title={isEditingNav ? "Done" : "Reorder pages"}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                  isLiquidGlass
                    ? isEditingNav
                      ? "bg-white/20 text-white"
                      : "text-white/60 hover:bg-white/15 hover:text-white"
                    : isEditingNav
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {isEditingNav ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}
        <TooltipProvider delayDuration={200}>
          {orderedNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            const isDragging = draggingNavId === item.id;
            const isDropTarget = dropNavId === item.id && draggingNavId !== item.id;

            const button = (
              <button
                type="button"
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                draggable={isEditingNav && !compact}
                onDragStart={(event) => {
                  if (!isEditingNav || compact) return;
                  handleNavDragStart(event, item.id);
                }}
                onDragOver={(event) => {
                  if (!isEditingNav || compact) return;
                  handleNavDragOver(event, item.id);
                }}
                onDrop={(event) => {
                  if (!isEditingNav || compact) return;
                  handleNavDrop(event, item.id);
                }}
                onDragEnd={handleNavDragEnd}
                onClick={() => {
                  if (isEditingNav && !compact) return;
                  onPageChange(item.id);
                  if (!isPinned || !isDesktopViewport()) closeSidebar();
                }}
                className={cn(
                  "group flex w-full items-center rounded-xl text-sm font-medium transition-all duration-300",
                  compact ? "justify-center px-2 py-2.5" : "gap-3 px-4 py-2.5",
                  isEditingNav && !compact && "cursor-grab active:cursor-grabbing",
                  isDragging && "opacity-40",
                  isDropTarget &&
                    (isLiquidGlass
                      ? "ring-1 ring-white/50 bg-white/15"
                      : "ring-1 ring-primary/50 bg-primary/10"),
                  isLiquidGlass
                    ? isActive
                      ? "bg-white text-neutral-800 shadow-sm"
                      : "border border-transparent text-white/90 hover:bg-white/20"
                    : isActive
                      ? "border border-primary/50 bg-gradient-to-r from-primary/20 to-secondary/10 text-foreground shadow-glow-sm"
                      : "border border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {isEditingNav && !compact ? (
                  <GripVertical
                    aria-hidden
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isLiquidGlass
                        ? isActive
                          ? "text-neutral-500"
                          : "text-white/50"
                        : "text-muted-foreground/70",
                    )}
                  />
                ) : null}
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
                {!compact && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {!isEditingNav ? (
                      <span
                        className={cn(
                          "ml-auto text-xs transition-all duration-300",
                          isActive ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0",
                        )}
                      >
                        ›
                      </span>
                    ) : null}
                  </>
                )}
              </button>
            );

            if (!compact) {
              return (
                <div key={item.id} className="w-full">
                  {button}
                </div>
              );
            }

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </nav>

      <div className="flex shrink-0 flex-col gap-3">
        {!compact ? <SidebarMusicPlayer /> : <SidebarRecordPlayer />}
        <div className={cn("flex items-center", compact ? "justify-center" : "justify-between gap-2")}>
          <button
            type="button"
            onClick={handleToggleIconsOnly}
            aria-label={iconsOnly ? "Show navigation labels" : "Icons only navigation"}
            aria-pressed={iconsOnly}
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
              isLiquidGlass
                ? "text-white/80 hover:bg-white/15 hover:text-white"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {iconsOnly ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          {!compact && (
            <p
              className={cn(
                "px-1 text-right text-[11px] leading-snug",
                isLiquidGlass ? "text-white/50" : "text-muted-foreground/70",
              )}
            >
              Data stored locally in your browser
            </p>
          )}
        </div>
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
        {!iconsOnly ? (
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
        ) : null}

        <div
          className={cn(
            "h-full transition-[padding] duration-300",
            isLiquidGlass ? "p-3 lg:p-3" : compact ? "p-2 lg:p-0" : "p-4 lg:p-0",
          )}
        >
          {isLiquidGlass ? (
            <LiquidGlassCard
              draggable={false}
              glowIntensity="sm"
              shadowIntensity="md"
              blurIntensity="md"
              borderRadius="24px"
              className={cn(
                "perf-contain flex h-full flex-col gap-6 transition-[width,padding] duration-300",
                panelWidth,
                compact ? "p-3" : "p-5",
              )}
            >
              {panelBody}
            </LiquidGlassCard>
          ) : (
            <div
              className={cn(
                "glass-strong perf-contain relative flex h-full flex-col gap-6 rounded-2xl shadow-card transition-[width,padding] duration-300 lg:rounded-none",
                panelWidth,
                compact ? "p-3" : "p-5",
              )}
            >
              {panelBody}
            </div>
          )}
        </div>
      </aside>

      {showSidebar && !iconsOnly && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}
    </>
  );
}
