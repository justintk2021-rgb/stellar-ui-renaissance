import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { JSONContent } from "@tiptap/core";
import { BookOpen, Clapperboard, FileText, Link2, Upload } from "lucide-react";
import type { Trade } from "@/types/trade";
import { isUnjournaledTrade } from "@/lib/notifications";
import { EMPTY_STUDY_DOC, studyDocWith, videoBlockFromLink } from "@/lib/studyArea";
import { StudyTradeCard } from "./StudyTradeCard";
import type { StudyPlaybook } from "./studyEditorData";
import { cn } from "@/lib/utils";

const MAX_VIDEO_BYTES = 12 * 1024 * 1024;

type Step = "choose" | "video" | "trade";

export function StudyNoteComposer({
  trades,
  playbooks,
  onClose,
  onCreate,
}: {
  trades: Trade[];
  playbooks: StudyPlaybook[];
  onClose: () => void;
  onCreate: (input: { title: string; content: JSONContent }) => void;
}) {
  const [step, setStep] = useState<Step>("choose");
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [fileError, setFileError] = useState("");
  const [query, setQuery] = useState("");
  const [tradeId, setTradeId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const journalTrades = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = trades.some((trade) => !isUnjournaledTrade(trade) || trade.checklistId)
      ? trades.filter((trade) => !isUnjournaledTrade(trade) || trade.checklistId)
      : trades;
    return [...source]
      .sort((a, b) => (b.openTime || b.date || "").localeCompare(a.openTime || a.date || ""))
      .filter((trade) => {
        const playbook = playbooks.find((item) => item.id === trade.checklistId)?.name ?? "";
        const haystack = [trade.pair, trade.direction, trade.date, playbook].join(" ").toLowerCase();
        return !needle || haystack.includes(needle);
      });
  }, [playbooks, query, trades]);

  const createVideoLink = () => {
    const block = videoBlockFromLink(link);
    if (!block) {
      setLinkError("Paste a video link, such as a YouTube URL.");
      return;
    }
    onCreate({ title: "Video note", content: studyDocWith(block) });
  };

  const createUploadedVideo = (file: File) => {
    if (!file.type.startsWith("video/")) {
      setFileError("Choose a video file.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setFileError("That video is larger than 12 MB. Paste a link instead.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) {
        setFileError("Could not read that video.");
        return;
      }
      onCreate({
        title: file.name.replace(/\.[^.]+$/, "") || "Video note",
        content: studyDocWith({ type: "studyYoutube", attrs: { videoId: null, src } }),
      });
    };
    reader.onerror = () => setFileError("Could not read that video.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/45 p-4 backdrop-blur-xl" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-note-composer-title"
        className="glass-popup max-h-[min(640px,calc(100vh-2rem))] w-full max-w-2xl overflow-y-auto rounded-2xl p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="study-note-composer-title" className="text-lg font-semibold tracking-tight">
          {step === "choose" ? "New note" : step === "video" ? "Add a video" : "Journaled trade"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === "choose"
            ? "Choose how this note starts."
            : step === "video"
              ? "Paste a link or upload a video from this device."
              : "Pick a trade from your journal. Its playbook stays attached."}
        </p>

        {step === "choose" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <OptionButton icon={<FileText className="h-5 w-5" />} title="Blank page" detail="Start with an empty note." onClick={() => onCreate({ title: "Untitled note", content: EMPTY_STUDY_DOC })} />
            <OptionButton icon={<Clapperboard className="h-5 w-5" />} title="Video" detail="Paste a link or upload one." onClick={() => setStep("video")} />
            <OptionButton icon={<BookOpen className="h-5 w-5" />} title="Journaled trade" detail="Linked to the journal and its playbook." onClick={() => setStep("trade")} />
          </div>
        ) : null}

        {step === "video" ? (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Link2 className="h-3.5 w-3.5" /> Paste a link</span>
              <input
                value={link}
                onChange={(event) => { setLink(event.target.value); setLinkError(""); }}
                placeholder="https://www.youtube.com/watch?v=…"
                className="h-10 w-full rounded-xl border border-border/50 bg-background/50 px-3 text-sm outline-none focus:border-primary/40"
              />
            </label>
            {linkError ? <p className="text-xs text-destructive">{linkError}</p> : null}
            <button type="button" onClick={createVideoLink} className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">
              Use link
            </button>
            <div className="border-t border-border/40 pt-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border/60 px-4 py-4 text-sm hover:bg-muted/30">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span>Upload a video</span>
                <input
                  type="file"
                  accept="video/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) createUploadedVideo(file);
                  }}
                />
              </label>
              {fileError ? <p className="mt-2 text-xs text-destructive">{fileError}</p> : null}
            </div>
          </div>
        ) : null}

        {step === "trade" ? (
          <div className="mt-5">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search journal trades or playbooks"
              className="mb-3 h-10 w-full rounded-xl border border-border/50 bg-background/50 px-3 text-sm outline-none focus:border-primary/40"
            />
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {journalTrades.length === 0 ? (
                <p className="px-2 py-6 text-sm text-muted-foreground">No journaled trades match.</p>
              ) : journalTrades.slice(0, 20).map((trade) => (
                <StudyTradeCard
                  key={trade.id}
                  tradeId={trade.id}
                  trades={trades}
                  playbooks={playbooks}
                  active={tradeId === trade.id}
                  onSelect={() => setTradeId(trade.id)}
                />
              ))}
            </div>
            <button
              type="button"
              disabled={!tradeId}
              onClick={() => {
                if (!tradeId) return;
                const trade = trades.find((item) => item.id === tradeId);
                onCreate({
                  title: trade?.pair ? `${trade.pair} review` : "Trade note",
                  content: studyDocWith({ type: "studyTrade", attrs: { tradeId } }),
                });
              }}
              className="mt-4 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
            >
              Use this trade
            </button>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          {step !== "choose" ? (
            <button type="button" onClick={() => setStep("choose")} className="rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              Back
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionButton({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex flex-col items-start gap-2 rounded-2xl border border-border/50 bg-background/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30")}
    >
      <span className="text-primary">{icon}</span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs leading-5 text-muted-foreground">{detail}</span>
    </button>
  );
}
