import { cn } from "@/lib/utils";
import { studyFolderColor } from "@/lib/studyArea";

/** Compact folder glyph (reference size); opens on parent `group-hover` (or when `open`). */
export function StudyFolderIcon({
  color,
  className,
  open,
}: {
  color?: string | null;
  className?: string;
  /** Force open (e.g. selected). Otherwise opens on group-hover. */
  open?: boolean;
}) {
  return (
    <span
      className={cn("relative inline-flex h-[18px] w-[20px] shrink-0 overflow-visible", className)}
      style={{ color: studyFolderColor(color) }}
      aria-hidden
    >
      {/* Closed — solid pocket folder */}
      <svg
        viewBox="0 0 20 18"
        className={cn(
          "absolute inset-0 h-full w-full transition-opacity duration-200 ease-out",
          open ? "opacity-0" : "opacity-100 group-hover:opacity-0",
        )}
      >
        <path
          fill="currentColor"
          d="M1.5 4.75A2.25 2.25 0 0 1 3.75 2.5h3.1c.4 0 .78.17 1.05.46l.7.8c.27.3.65.47 1.05.47h6.6A2.25 2.25 0 0 1 18.5 6.5v7.25a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 13.75V4.75Z"
        />
        <path
          fill="currentColor"
          opacity={0.35}
          d="M1.5 7h17v6.75A2.25 2.25 0 0 1 16.25 16H3.75A2.25 2.25 0 0 1 1.5 13.75V7Z"
        />
      </svg>

      {/* Open */}
      <svg
        viewBox="0 0 20 18"
        className={cn(
          "absolute inset-0 h-full w-full transition-all duration-200 ease-out",
          open
            ? "translate-y-0 opacity-100"
            : "translate-y-px opacity-0 group-hover:translate-y-0 group-hover:opacity-100",
        )}
      >
        <path
          fill="currentColor"
          opacity={0.4}
          d="M1.5 4.6A2.1 2.1 0 0 1 3.6 2.5h2.9c.37 0 .72.16.96.43l.55.64c.24.27.59.43.96.43h7.43A2.1 2.1 0 0 1 18.5 6.1V7H4.4A2.9 2.9 0 0 0 1.55 9.5L1.5 12V4.6Z"
        />
        <path
          fill="currentColor"
          d="M2.35 8.35c.22-.55.74-.95 1.34-.95h13.1c.9 0 1.56.84 1.36 1.7l-.95 4.15a1.95 1.95 0 0 1-1.9 1.5H4.55a1.95 1.95 0 0 1-1.9-1.55L1.85 9.5c-.15-.45-.05-.95.25-1.3.2-.2.4-.2.7-.2Z"
        />
      </svg>
    </span>
  );
}

/** Outlined folder with plus — matches the “new folder” reference. */
export function StudyFolderPlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 18"
      className={cn("h-[18px] w-[20px] shrink-0 text-muted-foreground", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.75 4.75A2 2 0 0 1 3.75 2.75h3c.35 0 .68.15.9.4l.65.75c.23.26.56.4.9.4h6.05A2 2 0 0 1 18.25 6.3v7.45a2 2 0 0 1-2 2H3.75a2 2 0 0 1-2-2V4.75Z" />
      <path d="M10 7.25v5M7.5 9.75h5" strokeLinecap="round" />
    </svg>
  );
}
