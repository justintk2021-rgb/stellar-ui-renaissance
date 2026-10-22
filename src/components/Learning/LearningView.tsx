import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { LESSONS, LESSON_CATEGORIES, type Lesson } from "./lessons";
import { BookOpen, Check, Search } from "lucide-react";

const STORAGE_KEY = "nsync-learning-progress";

function loadCompleted(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function LearningView() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof LESSON_CATEGORIES)[number]>("All");
  const [openId, setOpenId] = useState<string | null>(LESSONS[0]?.id ?? null);
  const [completed, setCompleted] = useState<string[]>(loadCompleted);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  }, [completed]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return LESSONS.filter((lesson) => {
      if (category !== "All" && lesson.category !== category) return false;
      if (!needle) return true;
      return (
        lesson.title.toLowerCase().includes(needle)
        || lesson.summary.toLowerCase().includes(needle)
        || lesson.category.toLowerCase().includes(needle)
      );
    });
  }, [query, category]);

  const doneCount = LESSONS.filter((lesson) => completed.includes(lesson.id)).length;
  const progress = LESSONS.length ? (doneCount / LESSONS.length) * 100 : 0;

  const toggleComplete = (id: string) => {
    setCompleted((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl border border-border/40 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-[11px] uppercase tracking-widest">Library</span>
            </div>
            <h3 className="text-lg font-semibold">Trading notes</h3>
            <p className="max-w-xl text-sm text-muted-foreground">
              Short lessons on risk, execution, and how to write the journal so the stats stay useful.
            </p>
          </div>
          <div className="min-w-[180px]">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{doneCount} of {LESSONS.length} read</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search lessons"
              aria-label="Search lessons"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {LESSON_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  category === item
                    ? "border-primary/50 bg-primary/15 text-foreground"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 px-6 py-12 text-center text-sm text-muted-foreground">
          No lessons match that search.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              open={openId === lesson.id}
              done={completed.includes(lesson.id)}
              onToggleOpen={() => setOpenId((current) => (current === lesson.id ? null : lesson.id))}
              onToggleComplete={() => toggleComplete(lesson.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonCard({
  lesson,
  open,
  done,
  onToggleOpen,
  onToggleComplete,
}: {
  lesson: Lesson;
  open: boolean;
  done: boolean;
  onToggleOpen: () => void;
  onToggleComplete: () => void;
}) {
  return (
    <article className="glass rounded-2xl border border-border/40">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">{lesson.category}</Badge>
            <span className="text-[11px] text-muted-foreground">{lesson.minutes} min</span>
            {done && <span className="text-[11px] text-primary">Read</span>}
          </div>
          <h3 className="mt-2 text-sm font-semibold sm:text-base">{lesson.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{lesson.summary}</p>
        </button>
        <button
          type="button"
          onClick={onToggleComplete}
          aria-pressed={done}
          aria-label={done ? `Mark “${lesson.title}” as unread` : `Mark “${lesson.title}” as read`}
          className={cn(
            "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
            done
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-border/60 text-muted-foreground hover:text-foreground",
          )}
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <ol className="space-y-3 border-t border-border/40 px-5 py-4 text-sm text-foreground/90">
          {lesson.points.map((point) => (
            <li key={point} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{point}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
